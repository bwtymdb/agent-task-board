export type Platform = 'kimi-code' | 'workbuddy' | 'kimi-work'
export type Light = 'red' | 'yellow' | 'green'
export type ThemeName = 'midnight' | 'yellow' | 'mint' | 'sky' | 'lavender' | 'rose'

export type BackgroundTask = { id: string; kind: string; description: string; status: string; command?: string }
export type ProgressEntry = { id: string; timestamp: number | null; summary: string; result?: string; files: string[] }
export type TaskProgress = { entries: ProgressEntry[]; notice?: string; ai?: { provider: string; model: string; generatedAt: number } }
export type ConversationTurn = { id: string; timestamp: number | null; user: string; assistant: string; files: string[] }
export type AiProvider = { id: string; name: string; kind: 'openai' | 'anthropic' | 'gemini'; baseUrl: string; docsUrl?: string }
export type AiModel = { id: string; name: string }
export type AiState = { provider: string; model: string; baseUrl?: string; hasKey: boolean; keyHint?: string; providers: AiProvider[]; models: AiModel[] }

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
  mainTurnActive?: boolean
  backgroundTasks?: BackgroundTask[]
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
  aiProvider: string
  aiModel: string
  aiBaseUrl?: string
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
  cancelBackgroundTask: (key: string, taskId: string) => Promise<{ ok: boolean; message: string }>
  openTask: (key: string) => Promise<{ ok: boolean; message: string }>
  getProgress: (key: string) => Promise<TaskProgress>
  getAiState: (provider?: string) => Promise<AiState>
  connectAi: (provider: string, apiKey: string, baseUrl?: string) => Promise<AiState>
  selectAiModel: (provider: string, model: string, baseUrl?: string) => Promise<AiState>
  summarizeProgress: (key: string) => Promise<TaskProgress>
  showProgress: (key: string) => void
  closeProgress: () => void
  installKimiHooks: () => Promise<{ ok: boolean; message: string }>
  toggleClickThrough: () => Promise<Settings>
  dockWindow: () => void
  hideWindow: () => void
}

declare global {
  interface Window { board: BoardApi }
}
