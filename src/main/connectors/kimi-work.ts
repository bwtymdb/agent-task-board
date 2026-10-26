import { existsSync, readFileSync, statSync, watch, type FSWatcher } from 'node:fs'
import { mapNativeStatus } from '../../shared/status.ts'
import type { ConnectorHealth, TaskItem } from '../../shared/types.ts'

export class KimiWorkConnector {
  readonly platform = 'kimi-work' as const
  private tasks: TaskItem[] = []
  private health: ConnectorHealth = { platform: 'kimi-work', connected: false, detail: '尚未连接', stale: false }
  private timer?: NodeJS.Timeout
  private watcher?: FSWatcher
  private refreshTimer?: NodeJS.Timeout

  constructor(private readonly filePath: string, private readonly notify: () => void) {}

  async start() {
    await this.refresh()
    this.timer = setInterval(() => void this.refresh(), 5000)
    if (existsSync(this.filePath)) {
      this.watcher = watch(this.filePath, () => {
        clearTimeout(this.refreshTimer)
        this.refreshTimer = setTimeout(() => void this.refresh(), 150)
      })
    }
  }

  async refresh() {
    try {
      const parsed = JSON.parse(readFileSync(this.filePath, 'utf8')) as Record<string, string>
      const modified = statSync(this.filePath).mtimeMs
      this.tasks = Object.entries(parsed).flatMap(([key, status]) => {
        const match = key.match(/conversation:([0-9a-f-]{36})/i)
        if (!match) return []
        const id = match[1]
        const mapped = mapNativeStatus('kimi-work', status)
        return [{
          key: `kimi-work:${id}`, nativeId: id, platform: 'kimi-work' as const,
          title: `未命名 Kimi Work 会话 · ${id.slice(0, 8)}`,
          light: mapped.light, reason: mapped.reason, updatedAt: modified,
          archived: false, unread: false, stale: false
        }]
      })
      this.health = { platform: 'kimi-work', connected: true, detail: `本地状态 · ${this.tasks.length} 个会话；标题和会话直达受平台接口限制`, stale: false }
    } catch (error) {
      this.tasks = this.tasks.map(task => ({ ...task, stale: true }))
      this.health = { platform: 'kimi-work', connected: false, detail: `读取失败：${error instanceof Error ? error.message : String(error)}`, stale: true }
    }
    this.notify()
  }

  getTasks() { return this.tasks }
  getHealth() { return this.health }
  async stop() {
    clearInterval(this.timer)
    clearTimeout(this.refreshTimer)
    this.watcher?.close()
  }
}
