import { compareTasks, reconcileHeartbeat } from '../../shared/status.ts'
import type { BoardSnapshot, ConnectorHealth, Settings, TaskItem } from '../../shared/types.ts'
import { KimiCodeConnector } from './kimi-code.ts'
import { KimiWorkConnector } from './kimi-work.ts'
import { WorkBuddyConnector } from './workbuddy.ts'

type Connector = {
  start: () => Promise<void>
  refresh: () => Promise<void>
  stop: () => Promise<void>
  getTasks: () => TaskItem[]
  getHealth: () => ConnectorHealth
}

export class ConnectorHub {
  readonly kimiCode: KimiCodeConnector
  readonly workBuddy: WorkBuddyConnector
  private readonly connectors: Connector[]
  private readonly listeners = new Set<(snapshot: BoardSnapshot) => void>()
  private notifyTimer?: NodeJS.Timeout
  private heartbeatTimer?: NodeJS.Timeout
  private lastSnapshot: BoardSnapshot = { tasks: [], health: [], updatedAt: Date.now() }

  constructor(private readonly getSettings: () => Settings, backupDirectory: string) {
    const settings = getSettings()
    const home = settings.kimiCodeHome || `${process.env.USERPROFILE}/.kimi-code`
    const workbuddyDb = settings.workbuddyDb || `${process.env.USERPROFILE}/.workbuddy/workbuddy.db`
    const workFile = settings.kimiWorkStatusFile || `${process.env.APPDATA}/kimi-desktop/kimi-agent/conversation-statuses.json`
    this.kimiCode = new KimiCodeConnector(home, () => this.scheduleNotify())
    this.workBuddy = new WorkBuddyConnector(workbuddyDb, () => this.scheduleNotify(), backupDirectory)
    this.connectors = [
      this.kimiCode,
      this.workBuddy,
      new KimiWorkConnector(workFile, () => this.scheduleNotify())
    ]
  }

  async start() {
    await Promise.allSettled(this.connectors.map(connector => connector.start()))
    this.heartbeatTimer = setInterval(() => this.scheduleNotify(), 15_000)
    await this.emit()
  }

  subscribe(listener: (snapshot: BoardSnapshot) => void) {
    this.listeners.add(listener)
    listener(this.lastSnapshot)
    return () => { this.listeners.delete(listener) }
  }

  async refresh() {
    await Promise.allSettled(this.connectors.map(connector => connector.refresh()))
    return this.emit()
  }

  async emit(): Promise<BoardSnapshot> {
    const settings = this.getSettings()
    const tasks = this.connectors.flatMap(connector => connector.getTasks())
      .map(task => ({
        ...task,
        title: task.platform === 'kimi-work' ? settings.aliases[task.key]?.trim() || task.title : task.title,
        focused: Boolean(settings.focused[task.key])
      }))
      .map(task => reconcileHeartbeat(task, Date.now()))
      .sort(compareTasks)
    this.lastSnapshot = {
      tasks,
      health: this.connectors.map(connector => connector.getHealth()),
      updatedAt: Date.now()
    }
    for (const listener of this.listeners) listener(this.lastSnapshot)
    return this.lastSnapshot
  }

  async renameTask(key: string, title: string) {
    if (key.startsWith('kimi-code:')) await this.kimiCode.rename(key.slice(10), title)
    else if (key.startsWith('workbuddy:')) await this.workBuddy.rename(key.slice(10), title)
    else if (key.startsWith('kimi-work:')) return
    else throw new Error('该平台不支持重命名')
  }

  async setArchived(key: string, archived: boolean) {
    if (key.startsWith('kimi-code:')) await this.kimiCode.setArchived(key.slice(10), archived)
    else if (key.startsWith('workbuddy:')) await this.workBuddy.setArchived(key.slice(10), archived)
    else throw new Error('该平台不支持归档')
  }

  async cancelBackgroundTask(key: string, taskId: string) {
    if (!key.startsWith('kimi-code:')) throw new Error('只有 Kimi Code 支持终止后台任务')
    await this.kimiCode.cancelBackgroundTask(key.slice(10), taskId)
  }

  getSnapshot() { return this.lastSnapshot }
  getTask(key: string) { return this.lastSnapshot.tasks.find(task => task.key === key) }

  private scheduleNotify() {
    clearTimeout(this.notifyTimer)
    this.notifyTimer = setTimeout(() => void this.emit(), 100)
  }

  async stop() {
    clearTimeout(this.notifyTimer)
    clearInterval(this.heartbeatTimer)
    await Promise.allSettled(this.connectors.map(connector => connector.stop()))
  }
}
