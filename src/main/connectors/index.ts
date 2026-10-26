import { compareTasks, reconcileHeartbeat } from '../../shared/status.ts'
import type { BoardSnapshot, ConnectorHealth, Settings, TaskItem } from '../../shared/types.ts'
import { KimiCodeConnector } from './kimi-code.ts'
import { KimiWorkConnector } from './kimi-work.ts'
import { WorkBuddyConnector } from './workbuddy.ts'
import { manualTaskItems } from './manual.ts'

type Connector = {
  start: () => Promise<void>
  refresh: () => Promise<void>
  stop: () => Promise<void>
  getTasks: () => TaskItem[]
  getHealth: () => ConnectorHealth
}

export class ConnectorHub {
  readonly kimiCode: KimiCodeConnector
  private readonly connectors: Connector[]
  private readonly listeners = new Set<(snapshot: BoardSnapshot) => void>()
  private notifyTimer?: NodeJS.Timeout
  private heartbeatTimer?: NodeJS.Timeout
  private lastSnapshot: BoardSnapshot = { tasks: [], health: [], updatedAt: Date.now() }

  constructor(private readonly getSettings: () => Settings) {
    const settings = getSettings()
    const home = settings.kimiCodeHome || `${process.env.USERPROFILE}/.kimi-code`
    const workbuddyDb = settings.workbuddyDb || `${process.env.USERPROFILE}/.workbuddy/workbuddy.db`
    const workFile = settings.kimiWorkStatusFile || `${process.env.APPDATA}/kimi-desktop/kimi-agent/conversation-statuses.json`
    this.kimiCode = new KimiCodeConnector(home, () => this.scheduleNotify())
    this.connectors = [
      this.kimiCode,
      new WorkBuddyConnector(workbuddyDb, () => this.scheduleNotify()),
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
      .concat(manualTaskItems(settings.manualTasks))
      .map(task => {
        const override = settings.overrides[task.key]
        return {
          ...task,
          title: settings.aliases[task.key]?.trim() || task.title,
          archived: settings.archived[task.key] ?? task.archived,
          manualOverride: override,
          light: override ?? task.light,
          reason: override ? `手动设置为${override === 'red' ? '需处理' : override === 'yellow' ? '进行中' : '空闲'}` : task.reason
        }
      })
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
