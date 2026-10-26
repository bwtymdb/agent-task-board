import Database from 'better-sqlite3'
import { existsSync, watch, type FSWatcher } from 'node:fs'
import { dirname } from 'node:path'
import { mapNativeStatus } from '../../shared/status.ts'
import type { ConnectorHealth, TaskItem } from '../../shared/types.ts'

type Row = { id: string; title: string | null; custom_title: string | null; cwd: string; status: string; updated_at: number; unread: number }

export class WorkBuddyConnector {
  readonly platform = 'workbuddy' as const
  private db?: Database.Database
  private tasks: TaskItem[] = []
  private health: ConnectorHealth = { platform: 'workbuddy', connected: false, detail: '尚未连接', stale: false }
  private timer?: NodeJS.Timeout
  private watcher?: FSWatcher
  private refreshTimer?: NodeJS.Timeout

  constructor(private readonly dbPath: string, private readonly notify: () => void) {}

  async start() {
    await this.refresh()
    this.timer = setInterval(() => void this.refresh(), 2000)
    if (existsSync(this.dbPath)) {
      this.watcher = watch(dirname(this.dbPath), (event, filename) => {
        if (filename && !filename.toString().startsWith('workbuddy.db')) return
        clearTimeout(this.refreshTimer)
        this.refreshTimer = setTimeout(() => void this.refresh(), 150)
      })
    }
  }

  async refresh() {
    try {
      if (!this.db) this.db = new Database(this.dbPath, { readonly: true, fileMustExist: true })
      const rows = this.db.prepare(`SELECT id, title, custom_title, cwd, status, updated_at, unread
        FROM sessions WHERE deleted_at IS NULL`).all() as Row[]
      this.tasks = rows.map(row => {
        const mapped = mapNativeStatus('workbuddy', row.status)
        return {
          key: `workbuddy:${row.id}`, nativeId: row.id, platform: 'workbuddy',
          title: row.custom_title?.trim() || row.title?.trim() || '未命名 WorkBuddy 会话',
          cwd: row.cwd, light: mapped.light, reason: mapped.reason,
          updatedAt: Number(row.updated_at) || Date.now(), archived: row.status === 'archived',
          unread: Boolean(row.unread), stale: false
        }
      })
      this.health = { platform: 'workbuddy', connected: true, detail: `本地数据库 · ${rows.length} 个会话`, stale: false }
    } catch (error) {
      this.tasks = this.tasks.map(task => ({ ...task, stale: true }))
      this.health = { platform: 'workbuddy', connected: false, detail: `读取失败：${error instanceof Error ? error.message : String(error)}`, stale: true }
    }
    this.notify()
  }

  getTasks() { return this.tasks }
  getHealth() { return this.health }
  async stop() {
    clearInterval(this.timer)
    clearTimeout(this.refreshTimer)
    this.watcher?.close()
    this.db?.close()
  }
}
