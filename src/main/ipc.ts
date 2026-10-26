import { ipcMain } from 'electron'
import { randomUUID } from 'node:crypto'
import type { Light, Settings } from '../shared/types.ts'
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
    for (const key of ['opacity', 'alwaysOnTop', 'clickThrough', 'autoStart', 'kimiCodeHome', 'workbuddyDb', 'kimiWorkStatusFile'] as const) {
      if (key in patch) Object.assign(allowed, { [key]: patch[key] })
    }
    return updateSettings(allowed)
  })
  ipcMain.handle('task:rename', (event, key: string, title: string) => {
    if (typeof key !== 'string' || typeof title !== 'string' || !title.trim() || title.length > 200) throw new Error('标题不能为空且不能超过 200 字。')
    return updateSettings({ aliases: { ...getSettings().aliases, [key]: title.trim() } })
  })
  ipcMain.handle('task:archive', (event, key: string, archived: boolean) => {
    return updateSettings({ archived: { ...getSettings().archived, [key]: Boolean(archived) } })
  })
  ipcMain.handle('task:override', (event, key: string, light?: Light) => {
    const overrides = { ...getSettings().overrides }
    if (light) overrides[key] = light
    else delete overrides[key]
    return updateSettings({ overrides })
  })
  ipcMain.handle('manual:add', (event, title: string, url: string) => {
    if (!title?.trim() || title.length > 200) throw new Error('标题不能为空且不能超过 200 字。')
    const parsed = new URL(url)
    if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('仅支持 http/https 链接。')
    const manualTasks = [...getSettings().manualTasks, { id: randomUUID(), title: title.trim(), url: parsed.toString(), light: 'green' as const }]
    return updateSettings({ manualTasks })
  })
  ipcMain.handle('manual:remove', (event, id: string) => {
    const settings = getSettings()
    const manualTasks = settings.manualTasks.filter(task => task.id !== id)
    const aliases = { ...settings.aliases }
    const overrides = { ...settings.overrides }
    delete aliases[`manual:${id}`]
    delete overrides[`manual:${id}`]
    return updateSettings({ manualTasks, aliases, overrides })
  })
  ipcMain.handle('task:open', async (event, key: string) => {
    const task = hub.getTask(key)
    if (!task) return { ok: false, message: '任务已不存在，请刷新后重试。' }
    return openTask(task)
  })
  ipcMain.handle('kimi:install-hooks', () => context.installHooks())
  ipcMain.handle('window:toggle-click-through', () => board.toggleClickThrough())
  ipcMain.on('window:dock', () => board.dockToNearestEdge())
  ipcMain.on('window:hide', () => board.hide())
}

export function hookInstaller(hub: ConnectorHub, reporterPath: string, connectionPath: string) {
  return () => installKimiCodeHooks(hub.kimiCode.home, reporterPath, connectionPath)
}
