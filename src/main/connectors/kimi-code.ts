import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { mapNativeStatus } from '../../shared/status.ts'
import type { ConnectorHealth, TaskItem } from '../../shared/types.ts'
import { KimiCodeApi } from './kimi-code-api.ts'
import { readWireStatus } from './kimi-code-wire.ts'

type IndexEntry = { sessionId: string; sessionDir: string; workDir?: string }
type HookPayload = {
  hook_event_name?: string
  session_id?: string
  sessionId?: string
  session_title?: string
  cwd?: string
  kind?: string
  task_kind?: string
}

export class KimiCodeConnector {
  readonly platform = 'kimi-code' as const
  private readonly api: KimiCodeApi
  private history = new Map<string, TaskItem>()
  private live = new Map<string, TaskItem>()
  private wire = new Map<string, TaskItem>()
  private apiTasks = new Map<string, TaskItem>()
  private apiAvailable = false
  private timer?: NodeJS.Timeout
  private refreshing = false
  private health: ConnectorHealth = { platform: 'kimi-code', connected: false, detail: '尚未连接', stale: false }

  constructor(readonly home: string, private readonly notify: () => void) {
    this.api = new KimiCodeApi(home)
  }

  async start() {
    await this.refresh()
    this.timer = setInterval(() => void this.refresh(), 2000)
  }

  async refresh() {
    if (this.refreshing) return
    this.refreshing = true
    try {
      const entries = readFileSync(join(this.home, 'session_index.jsonl'), 'utf8').split(/\r?\n/).filter(Boolean)
        .flatMap(line => { try { return [JSON.parse(line) as IndexEntry] } catch { return [] } })
      const next = new Map<string, TaskItem>()
      for (const entry of entries) {
        if (!entry.sessionId || !entry.sessionDir) continue
        const statePath = join(entry.sessionDir, 'state.json')
        if (!existsSync(statePath)) continue
        try {
          const state = JSON.parse(readFileSync(statePath, 'utf8'))
          next.set(entry.sessionId, {
            key: `kimi-code:${entry.sessionId}`, nativeId: entry.sessionId, platform: 'kimi-code',
            title: state.title || '未命名 Kimi Code 会话', cwd: state.cwd || entry.workDir,
            light: 'green', reason: '历史 / 空闲', updatedAt: Number(state.updatedAt) || Date.now(),
            archived: Boolean(state.archived), unread: false, stale: false, focused: false
          })
        } catch { /* Keep the previous valid snapshot for a file being replaced. */ }
      }
      this.history = next
      try {
        const sessions = await this.api.listSessions()
        await Promise.all(sessions.filter(task => task.reason === '后台任务进行中').map(async task => {
          task.backgroundTasks = await this.api.listTasks(task.nativeId)
        }))
        this.apiTasks = new Map(sessions.map(task => [task.key, task]))
        this.apiAvailable = true
      } catch {
        this.apiAvailable = false
      }
      if (!this.apiAvailable) {
        for (const entry of entries) {
          const key = `kimi-code:${entry.sessionId}`
          if (!existsSync(join(this.home, 'locks', 'sessions', `${entry.sessionId}.lock`)) && !this.live.has(key)) continue
          const status = readWireStatus(join(entry.sessionDir, 'agents', 'main', 'wire.jsonl'))
          const base = this.history.get(entry.sessionId)
          if (status && base) this.wire.set(key, { ...base, ...status, stale: false })
        }
      }
      this.health = {
        platform: 'kimi-code', connected: true,
        detail: `${this.apiAvailable ? '官方实时状态' : '本地事件回放'} + Hooks · ${next.size} 个会话`,
        stale: !this.apiAvailable
      }
    } catch (error) {
      this.health = { platform: 'kimi-code', connected: false, detail: `读取失败：${error instanceof Error ? error.message : String(error)}`, stale: true }
    } finally {
      this.refreshing = false
    }
    this.notify()
  }

  ingest(payload: HookPayload) {
    const id = payload.session_id || payload.sessionId
    const event = payload.hook_event_name
    if (!id || !event) return
    const key = `kimi-code:${id}`
    const previous = this.live.get(key) || this.history.get(key)
    const base: TaskItem = previous || {
      key, nativeId: id, platform: 'kimi-code', title: payload.session_title || '未命名 Kimi Code 会话',
      cwd: payload.cwd, light: 'green', reason: '空闲', updatedAt: Date.now(), archived: false, unread: false, stale: false, focused: false
    }
    let next = { ...base, title: payload.session_title || base.title, cwd: payload.cwd || base.cwd, stale: false }
    if (event === 'SessionHeartbeat') {
      if (next.light !== 'green') next.updatedAt = Date.now()
      this.live.set(key, next)
      this.notify()
      return
    }
    if (event === 'PermissionRequest' || (event === 'TaskStarted' && (payload.kind === 'question' || payload.task_kind === 'question'))) {
      next = { ...next, ...mapNativeStatus('kimi-code', 'pending'), updatedAt: Date.now() }
    } else if (event === 'StopFailure') {
      next = { ...next, ...mapNativeStatus('kimi-code', 'failed'), updatedAt: Date.now() }
    } else if (event === 'Stop' || event === 'Interrupt' || (event === 'SessionEnd' && next.light !== 'red')) {
      next = { ...next, ...mapNativeStatus('kimi-code', 'completed'), updatedAt: Date.now() }
    } else if (['TurnStarted', 'UserPromptSubmit', 'TaskStarted', 'PermissionResult'].includes(event)) {
      next = { ...next, ...mapNativeStatus('kimi-code', 'working'), updatedAt: Date.now(), heartbeat: true }
    }
    this.live.set(key, next)
    this.notify()
  }

  async rename(id: string, title: string) {
    await this.api.rename(id, title)
    await this.refresh()
  }

  async setArchived(id: string, archived: boolean) {
    await this.api.setArchived(id, archived)
    await this.refresh()
  }

  async cancelBackgroundTask(id: string, taskId: string) {
    await this.api.cancelTask(id, taskId)
    await this.refresh()
  }

  getTasks() {
    const merged = new Map([...this.history.values()].map(task => [task.key, task]))
    if (!this.apiAvailable) for (const [key, value] of this.wire) merged.set(key, { ...merged.get(key), ...value })
    for (const [key, value] of this.live) merged.set(key, { ...merged.get(key), ...value })
    if (this.apiAvailable) for (const [key, value] of this.apiTasks) merged.set(key, { ...merged.get(key), ...value })
    return [...merged.values()]
  }
  getHealth() { return this.health }
  async stop() { clearInterval(this.timer) }
}
