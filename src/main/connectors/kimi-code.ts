import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { mapNativeStatus } from '../../shared/status.ts'
import type { ConnectorHealth, TaskItem } from '../../shared/types.ts'

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
  private history = new Map<string, TaskItem>()
  private live = new Map<string, TaskItem>()
  private health: ConnectorHealth = { platform: 'kimi-code', connected: false, detail: '尚未连接', stale: false }

  constructor(readonly home: string, private readonly notify: () => void) {}

  async start() { await this.refresh() }

  async refresh() {
    try {
      const indexPath = join(this.home, 'session_index.jsonl')
      const entries = readFileSync(indexPath, 'utf8').split(/\r?\n/).filter(Boolean)
        .flatMap(line => { try { return [JSON.parse(line) as IndexEntry] } catch { return [] } })
      const next = new Map<string, TaskItem>()
      for (const entry of entries) {
        if (!entry.sessionId || !entry.sessionDir) continue
        const statePath = join(entry.sessionDir, 'state.json')
        if (!existsSync(statePath)) continue
        try {
          const state = JSON.parse(readFileSync(statePath, 'utf8'))
          const updatedAt = Number(state.updatedAt) || Date.parse(state.updatedAt) || Date.now()
          next.set(entry.sessionId, {
            key: `kimi-code:${entry.sessionId}`, nativeId: entry.sessionId, platform: 'kimi-code',
            title: state.title || '未命名 Kimi Code 会话', cwd: state.cwd || entry.workDir,
            light: 'green', reason: '历史 / 空闲', updatedAt,
            archived: Boolean(state.archived), unread: false, stale: false
          })
        } catch { /* Skip a state file that is being replaced. */ }
      }
      this.history = next
      this.health = { platform: 'kimi-code', connected: true, detail: `本地会话 + Hooks · ${next.size} 个会话`, stale: false }
    } catch (error) {
      this.health = { platform: 'kimi-code', connected: false, detail: `读取失败：${error instanceof Error ? error.message : String(error)}`, stale: true }
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
      cwd: payload.cwd, light: 'green', reason: '空闲', updatedAt: Date.now(), archived: false, unread: false, stale: false
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

  getTasks() {
    const merged = new Map([...this.history.values()].map(task => [task.key, task]))
    for (const [key, value] of this.live) merged.set(key, { ...merged.get(key), ...value })
    return [...merged.values()]
  }
  getHealth() { return this.health }
  async stop() {}
}
