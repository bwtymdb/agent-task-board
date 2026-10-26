import { app, globalShortcut, Menu, nativeImage, Tray } from 'electron'
import { join } from 'node:path'
import { LocalStore } from './store.ts'
import { ConnectorHub } from './connectors/index.ts'
import { BoardWindow } from './window.ts'
import { HookEventServer } from './event-server.ts'
import { hookInstaller, registerIpc } from './ipc.ts'
import type { Settings } from '../shared/types.ts'

let board: BoardWindow | undefined
let hub: ConnectorHub | undefined
let hookServer: HookEventServer | undefined
let tray: Tray | undefined
let quitting = false

const singleInstance = app.requestSingleInstanceLock()
if (!singleInstance) app.quit()
else {
  app.on('second-instance', () => board?.show())
  app.whenReady().then(async () => {
    const store = new LocalStore(join(app.getPath('userData'), 'settings.json'))
    let settings = store.load()
    const saveSettings = (patch: Partial<Settings>) => {
      settings = store.update(patch)
      if (patch.autoStart !== undefined) app.setLoginItemSettings({ openAtLogin: settings.autoStart })
      return settings
    }
    hub = new ConnectorHub(() => settings, join(app.getPath('userData'), 'backups'))
    const onSettings = (next: Settings) => {
      settings = next
      board?.broadcast('settings:changed', next)
      void hub?.emit()
    }
    board = new BoardWindow(settings, saveSettings, onSettings)
    board.win.on('close', event => {
      if (!quitting) { event.preventDefault(); board?.hide() }
    })
    hookServer = new HookEventServer(hub.kimiCode, join(app.getPath('userData'), 'hook-connection.json'))
    await hookServer.start().catch(error => console.error('Hook server failed:', error instanceof Error ? error.message : error))
    registerIpc({
      hub, board, getSettings: () => settings,
      updateSettings: patch => board!.update(patch),
      installHooks: hookInstaller(
        hub,
        app.isPackaged ? join(process.resourcesPath, 'hook-reporter.cjs') : join(process.cwd(), 'resources', 'hook-reporter.cjs'),
        join(app.getPath('userData'), 'hook-connection.json')
      )
    })
    hub.subscribe(snapshot => {
      board?.broadcast('snapshot:changed', snapshot)
      board?.updateDockTasks(snapshot.tasks)
    })
    await hub.start()

    const iconPath = app.isPackaged ? join(process.resourcesPath, 'icon.png') : join(process.cwd(), 'resources', 'icon.png')
    tray = new Tray(nativeImage.createFromPath(iconPath))
    tray.setToolTip('AI 任务看板 · Ctrl+Alt+Space 切换穿透')
    const rebuildTray = () => tray?.setContextMenu(Menu.buildFromTemplate([
      { label: '打开看板', click: () => board?.show() },
      { label: settings.clickThrough ? '关闭鼠标穿透' : '开启鼠标穿透', click: () => { board?.toggleClickThrough(); rebuildTray() } },
      { type: 'separator' },
      { label: '退出', click: () => { quitting = true; app.quit() } }
    ]))
    rebuildTray()
    board.win.on('show', rebuildTray)
    globalShortcut.register('Control+Alt+Space', () => { board?.toggleClickThrough(); rebuildTray() })
  }).catch(error => console.error('Startup failed:', error))

  app.on('activate', () => board?.show())
  app.on('window-all-closed', () => {})
  app.on('before-quit', () => {
    quitting = true
    globalShortcut.unregisterAll()
    void hookServer?.stop()
    void hub?.stop()
  })
  app.on('will-quit', () => tray?.destroy())
}
