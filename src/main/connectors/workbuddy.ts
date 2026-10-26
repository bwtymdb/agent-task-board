import Database from 'better-sqlite3'
import { existsSync, mkdirSync, watch, type FSWatcher } from 'node:fs'
import { dirname, join } from 'node:path'
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

  constructor(private readonly dbPath: string, private readonly notify: () => void, private readonly backupDirectory: string) {}

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

  private async backup() {
    if (!this.db) throw new Error('WorkBuddy 数据库尚未连接')
    mkdirSync(this.backupDirectory, { recursive: true })
    await this.db.backup(join(this.backupDirectory, `workbuddy-${Date.now()}.db`))
  }

  async rename(id: string, title: string) {
    if (!title.trim() || title.length > 200) throw new Error('标题不能为空且不能超过 200 字')
    await this.backup()
    const db = new Database(this.dbPath)
    try {
      db.transaction(() => {
        const result = db.prepare('UPDATE sessions SET title = ?, custom_title = ?, updated_at = ? WHERE id = ?').run(title.trim(), title.trim(), Date.now(), id)
        if (result.changes !== 1) throw new Error('未找到要重命名的 WorkBuddy 会话')
        const row = db.prepare('SELECT title, custom_title FROM sessions WHERE id = ?').get(id) as { title?: string; custom_title?: string }
        if (row.title !== title.trim() || row.custom_title !== title.trim()) throw new Error('WorkBuddy 重命名回读校验失败')
      })()
    } finally { db.close() }
    await this.refresh()
  }

  async setArchived(id: string, archived: boolean) {
    await this.backup()
    const db = new Database(this.dbPath)
    try {
      db.transaction(() => {
        const current = db.prepare('SELECT status FROM sessions WHERE id = ?').get(id) as { status?: string } | undefined
        if (!current?.status) throw new Error('未找到要归档的 WorkBuddy 会话')
        if (archived && !['active', 'completed', 'idle', 'archived'].includes(current.status)) throw new Error('进行中的会话请先等待完成，再归档')
        const next = archived ? 'archived' : 'completed'
        const result = db.prepare('UPDATE sessions SET status = ?, updated_at = ? WHERE id = ?').run(next, Date.now(), id)
        if (result.changes !== 1) throw new Error('WorkBuddy 归档状态更新失败')
        const row = db.prepare('SELECT status FROM sessions WHERE id = ?').get(id) as { status?: string }
        if (row.status !== next) throw new Error('WorkBuddy 归档回读校验失败')
      })()
    } finally { db.close() }
    await this.refresh()
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
