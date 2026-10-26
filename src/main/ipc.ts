import { ipcMain } from 'electron'
import type { Settings } from '../shared/types.ts'
import type { ConnectorHub } from './connectors/index.ts'
import type { BoardWindow } from './window.ts'
import { openTask } from './open-target.ts'
import { installKimiCodeHooks } from './kimi-hooks.ts'

export type IpcContext = {
  hub: ConnectorHub
  board: BoardWindow
  getSettings: () => Settings
  updateSettings: (patch: Partial<Settings>) => Settings
  installHooks: () => { ok: boolean; message: string }
}

export function registerIpc(context: IpcContext) {
  const { hub, board, getSettings, updateSettings } = context
  ipcMain.handle('snapshot:get', () => hub.getSnapshot())
  ipcMain.handle('snapshot:refresh', () => hub.refresh())
  ipcMain.handle('settings:get', () => getSettings())
  ipcMain.handle('settings:update', (event, patch: Partial<Settings>) => {
    const allowed: Partial<Settings> = {}
    for (const key of ['opacity', 'alwaysOnTop', 'clickThrough', 'autoStart', 'theme', 'kimiCodeOpenTarget', 'kimiCodeHome', 'workbuddyDb', 'kimiWorkStatusFile'] as const) {
      if (key in patch) Object.assign(allowed, { [key]: patch[key] })
    }
    return updateSettings(allowed)
  })
  ipcMain.handle('task:rename', async (event, key: string, title: string) => {
    if (typeof title !== 'string' || !title.trim() || title.length > 200) return { ok: false, message: '标题不能为空且不能超过 200 字。' }
    if (key.startsWith('kimi-work:')) {
      updateSettings({ aliases: { ...getSettings().aliases, [key]: title.trim() } })
      return { ok: true, message: '看板别名已更新，不会影响 Kimi Work 原会话标题。' }
    }
    await hub.renameTask(key, title.trim())
    return { ok: true, message: '已在看板和原平台同步重命名。' }
  })
  ipcMain.handle('task:archive', async (event, key: string, archived: boolean) => {
    await hub.setArchived(key, archived)
    return { ok: true, message: archived ? '已在原平台归档。' : '已在原平台恢复。' }
  })
  ipcMain.handle('task:toggle-focus', (event, key: string) => {
    const focused = { ...getSettings().focused }
    if (focused[key]) delete focused[key]
    else focused[key] = true
    return updateSettings({ focused })
  })
  ipcMain.handle('task:cancel-background', async (event, key: string, taskId: string) => {
    await hub.cancelBackgroundTask(key, taskId)
    return { ok: true, message: '已终止指定的后台任务。' }
  })
  ipcMain.handle('task:open', async (event, key: string) => {
    const task = hub.getTask(key)
    if (!task) return { ok: false, message: '任务已不存在，请刷新后重试。' }
    return openTask(task, getSettings().kimiCodeOpenTarget)
  })
  ipcMain.handle('kimi:install-hooks', () => context.installHooks())
  ipcMain.handle('window:toggle-click-through', () => board.toggleClickThrough())
  ipcMain.on('window:dock', () => board.dockToNearestEdge())
  ipcMain.on('window:hide', () => board.hide())
}

export function hookInstaller(hub: ConnectorHub, reporterPath: string, connectionPath: string) {
  return () => installKimiCodeHooks(hub.kimiCode.home, reporterPath, connectionPath)
}
