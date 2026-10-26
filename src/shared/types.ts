export type Platform = 'kimi-code' | 'workbuddy' | 'kimi-work'
export type Light = 'red' | 'yellow' | 'green'
export type ThemeName = 'midnight' | 'yellow' | 'mint' | 'sky' | 'lavender' | 'rose'

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
  stale: boolean
  focused?: boolean
  heartbeat?: boolean
  url?: string
}

export type ConnectorHealth = { platform: Platform; connected: boolean; detail: string; stale: boolean }
export type WindowBounds = { x: number; y: number; width: number; height: number }
export type DockEdge = 'left' | 'right' | 'top' | 'bottom' | null
export type DockState = { collapsed: boolean; edge: DockEdge }

export type Settings = {
  opacity: number
  alwaysOnTop: boolean
  clickThrough: boolean
  autoStart: boolean
  bounds?: WindowBounds
  dockEdge: DockEdge
  theme: ThemeName
  focused: Record<string, boolean>
  kimiCodeOpenTarget: 'desktop' | 'cli'
  kimiCodeHome?: string
  workbuddyDb?: string
  kimiWorkStatusFile?: string
  aliases: Record<string, string>
  archived: Record<string, boolean>
  overrides: Record<string, Light>
}

export type BoardSnapshot = { tasks: TaskItem[]; health: ConnectorHealth[]; updatedAt: number }

export type BoardApi = {
  getSnapshot: () => Promise<BoardSnapshot>
  getSettings: () => Promise<Settings>
  onSnapshot: (callback: (snapshot: BoardSnapshot) => void) => () => void
  onSettings: (callback: (settings: Settings) => void) => () => void
  onDockState: (callback: (state: DockState) => void) => () => void
  refresh: () => Promise<BoardSnapshot>
  updateSettings: (patch: Partial<Settings>) => Promise<Settings>
  renameTask: (key: string, title: string) => Promise<{ ok: boolean; message: string }>
  archiveTask: (key: string, archived: boolean) => Promise<{ ok: boolean; message: string }>
  toggleFocus: (key: string) => Promise<Settings>
  openTask: (key: string) => Promise<{ ok: boolean; message: string }>
  installKimiHooks: () => Promise<{ ok: boolean; message: string }>
  toggleClickThrough: () => Promise<Settings>
  dockWindow: () => void
  hideWindow: () => void
}

declare global {
  interface Window { board: BoardApi }
}
