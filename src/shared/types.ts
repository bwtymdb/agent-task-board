export type Platform = 'kimi-code' | 'workbuddy' | 'kimi-work' | 'manual'
export type Light = 'red' | 'yellow' | 'green'

export type TaskItem = {
  key: string
  nativeId: string
  platform: Platform
  title: string
  cwd?: string
  light: Light
  reason: string
  updatedAt: number
  archived: boolean
  unread: boolean
  manualOverride?: Light
  stale: boolean
  heartbeat?: boolean
  url?: string
}

export type ConnectorHealth = {
  platform: Exclude<Platform, 'manual'>
  connected: boolean
  detail: string
  stale: boolean
}

export type ManualTask = {
  id: string
  title: string
  url: string
  light: Light
}

export type WindowBounds = { x: number; y: number; width: number; height: number }
export type DockEdge = 'left' | 'right' | 'top' | 'bottom' | null

export type Settings = {
  opacity: number
  alwaysOnTop: boolean
  clickThrough: boolean
  autoStart: boolean
  bounds?: WindowBounds
  dockEdge: DockEdge
  kimiCodeHome?: string
  workbuddyDb?: string
  kimiWorkStatusFile?: string
  aliases: Record<string, string>
  archived: Record<string, boolean>
  overrides: Record<string, Light>
  manualTasks: ManualTask[]
}

export type BoardSnapshot = {
  tasks: TaskItem[]
  health: ConnectorHealth[]
  updatedAt: number
}

export type BoardApi = {
  getSnapshot: () => Promise<BoardSnapshot>
  getSettings: () => Promise<Settings>
  onSnapshot: (callback: (snapshot: BoardSnapshot) => void) => () => void
  onSettings: (callback: (settings: Settings) => void) => () => void
  refresh: () => Promise<BoardSnapshot>
  updateSettings: (patch: Partial<Settings>) => Promise<Settings>
  renameTask: (key: string, title: string) => Promise<Settings>
  archiveTask: (key: string, archived: boolean) => Promise<Settings>
  overrideTask: (key: string, light?: Light) => Promise<Settings>
  addManualTask: (title: string, url: string) => Promise<Settings>
  removeManualTask: (id: string) => Promise<Settings>
  openTask: (key: string) => Promise<{ ok: boolean; message: string }>
  installKimiHooks: () => Promise<{ ok: boolean; message: string }>
  toggleClickThrough: () => Promise<Settings>
  dockWindow: () => void
  hideWindow: () => void
}

declare global {
  interface Window { board: BoardApi }
}
