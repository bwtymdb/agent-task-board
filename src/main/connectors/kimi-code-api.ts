import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { mapNativeStatus } from '../../shared/status.ts'
import type { BackgroundTask, TaskItem } from '../../shared/types.ts'

type ApiSession = {
  id: string
  title?: string
  created_at?: string
  updated_at?: string
  archived?: boolean
  busy?: boolean
  main_turn_active?: boolean
  pending_interaction?: string
  last_turn_reason?: string
  metadata?: { cwd?: string }
}
type Envelope = { code: number; msg?: string; data?: { items?: ApiSession[]; has_more?: boolean } }

export class KimiCodeApi {
  private token?: string
  private baseUrl?: string

  constructor(private readonly home: string) {}

  private async discover() {
    const directory = join(this.home, 'server', 'instances')
    const instances = readdirSync(directory).filter(name => name.endsWith('.json')).flatMap(name => {
      try {
        const value = JSON.parse(readFileSync(join(directory, name), 'utf8'))
        return value.host === '127.0.0.1' && value.port && Date.now() - Number(value.heartbeat_at) < 30_000 ? [value] : []
      } catch { return [] }
    }).sort((a, b) => Number(b.heartbeat_at) - Number(a.heartbeat_at))
    if (!instances.length) throw new Error('没有可用的 Kimi Code 本地服务')
    this.baseUrl = `http://127.0.0.1:${instances[0].port}`
    const tokenPath = join(this.home, 'server.token')
    if (!existsSync(tokenPath)) throw new Error('Kimi Code 本地服务尚未完成鉴权')
    this.token = readFileSync(tokenPath, 'utf8').trim()
  }

  private async request(path: string, init?: RequestInit) {
    if (!this.baseUrl || !this.token) await this.discover()
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${this.token}`, 'Content-Type': 'application/json', ...init?.headers },
      signal: AbortSignal.timeout(4000)
    })
    if (!response.ok) throw new Error(`Kimi Code API HTTP ${response.status}`)
    const envelope = await response.json() as Envelope & { data?: unknown }
    if (envelope.code !== 0) throw new Error(envelope.msg || `Kimi Code API ${envelope.code}`)
    return envelope.data
  }

  async listSessions(): Promise<TaskItem[]> {
    const items: ApiSession[] = []
    let beforeId = ''
    for (let page = 0; page < 20; page++) {
      const query = new URLSearchParams({ page_size: '100', include_archive: 'true' })
      if (beforeId) query.set('before_id', beforeId)
      const data = await this.request(`/api/v1/sessions?${query}`) as { items?: ApiSession[]; has_more?: boolean } | undefined
      const batch = data?.items ?? []
      items.push(...batch)
      if (!data?.has_more || !batch.length) break
      beforeId = batch.at(-1)!.id
    }
    return items.map(session => {
      const pending = ['approval', 'question'].includes(session.pending_interaction || '')
      const failed = session.last_turn_reason === 'failed'
      const mapped = pending ? mapNativeStatus('kimi-code', 'pending')
        : failed ? mapNativeStatus('kimi-code', 'failed')
        : session.busy || session.main_turn_active ? mapNativeStatus('kimi-code', 'working')
        : mapNativeStatus('kimi-code', 'completed')
      return {
        key: `kimi-code:${session.id}`, nativeId: session.id, platform: 'kimi-code',
        title: session.title || '未命名 Kimi Code 会话', cwd: session.metadata?.cwd,
        light: mapped.light, reason: session.busy && !session.main_turn_active ? '后台任务进行中' : mapped.reason,
        updatedAt: Date.parse(session.updated_at || '') || Date.now(),
        archived: Boolean(session.archived), unread: false, stale: false, focused: false,
        mainTurnActive: session.main_turn_active
      }
    })
  }

  async listTasks(id: string): Promise<BackgroundTask[]> {
    const data = await this.request(`/api/v1/sessions/${encodeURIComponent(id)}/tasks?status=running`) as { items?: BackgroundTask[] } | undefined
    return data?.items ?? []
  }

  async getTask(id: string, taskId: string): Promise<BackgroundTask> {
    return await this.request(`/api/v1/sessions/${encodeURIComponent(id)}/tasks/${encodeURIComponent(taskId)}`) as BackgroundTask
  }

  async cancelTask(id: string, taskId: string) {
    await this.request(`/api/v1/sessions/${encodeURIComponent(id)}/tasks/${encodeURIComponent(taskId)}:cancel`, { method: 'POST', body: '{}' })
  }

  async rename(id: string, title: string) {
    await this.request(`/api/v1/sessions/${encodeURIComponent(id)}/profile`, { method: 'POST', body: JSON.stringify({ title }) })
  }

  async setArchived(id: string, archived: boolean) {
    await this.request(`/api/v1/sessions/${encodeURIComponent(id)}:${archived ? 'archive' : 'restore'}`, { method: 'POST', body: '{}' })
  }
}
