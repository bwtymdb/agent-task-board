import { contextBridge, ipcRenderer } from 'electron'
import type { BoardApi, BoardSnapshot, DockState, Settings } from '../shared/types.ts'

function subscribe<T>(channel: string, callback: (value: T) => void) {
  const listener = (_event: Electron.IpcRendererEvent, value: T) => callback(value)
  ipcRenderer.on(channel, listener)
  return () => ipcRenderer.removeListener(channel, listener)
}

const api: BoardApi = {
  getSnapshot: () => ipcRenderer.invoke('snapshot:get'),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  onSnapshot: callback => subscribe<BoardSnapshot>('snapshot:changed', callback),
  onSettings: callback => subscribe<Settings>('settings:changed', callback),
  onDockState: callback => subscribe<DockState>('dock:state', callback),
  refresh: () => ipcRenderer.invoke('snapshot:refresh'),
  updateSettings: patch => ipcRenderer.invoke('settings:update', patch),
  renameTask: (key, title) => ipcRenderer.invoke('task:rename', key, title),
  archiveTask: (key, archived) => ipcRenderer.invoke('task:archive', key, archived),
  toggleFocus: key => ipcRenderer.invoke('task:toggle-focus', key),
  cancelBackgroundTask: (key, taskId) => ipcRenderer.invoke('task:cancel-background', key, taskId),
  openTask: key => ipcRenderer.invoke('task:open', key),
  installKimiHooks: () => ipcRenderer.invoke('kimi:install-hooks'),
  toggleClickThrough: () => ipcRenderer.invoke('window:toggle-click-through'),
  dockWindow: () => ipcRenderer.send('window:dock'),
  hideWindow: () => ipcRenderer.send('window:hide')
}

contextBridge.exposeInMainWorld('board', api)
