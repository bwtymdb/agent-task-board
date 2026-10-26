import { contextBridge, ipcRenderer } from 'electron'
import type { BoardApi, BoardSnapshot, Light, Settings } from '../shared/types.ts'

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
  refresh: () => ipcRenderer.invoke('snapshot:refresh'),
  updateSettings: patch => ipcRenderer.invoke('settings:update', patch),
  renameTask: (key, title) => ipcRenderer.invoke('task:rename', key, title),
  archiveTask: (key, archived) => ipcRenderer.invoke('task:archive', key, archived),
  overrideTask: (key, light) => ipcRenderer.invoke('task:override', key, light),
  addManualTask: (title, url) => ipcRenderer.invoke('manual:add', title, url),
  removeManualTask: id => ipcRenderer.invoke('manual:remove', id),
  openTask: key => ipcRenderer.invoke('task:open', key),
  installKimiHooks: () => ipcRenderer.invoke('kimi:install-hooks'),
  toggleClickThrough: () => ipcRenderer.invoke('window:toggle-click-through'),
  dockWindow: () => ipcRenderer.send('window:dock'),
  hideWindow: () => ipcRenderer.send('window:hide')
}

contextBridge.exposeInMainWorld('board', api)
