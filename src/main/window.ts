import { BrowserWindow, screen } from 'electron'
import { join } from 'node:path'
import type { DockEdge, Settings, WindowBounds } from '../shared/types.ts'

export class BoardWindow {
  readonly win: BrowserWindow
  private settings: Settings
  private applyingBounds = false
  private expandedBounds?: WindowBounds
  private hoverExpanded = false
  private outsideSince = 0
  private saveTimer?: NodeJS.Timeout
  private dockTimer?: NodeJS.Timeout

  constructor(settings: Settings, private readonly saveSettings: (patch: Partial<Settings>) => Settings, private readonly onSettings: (settings: Settings) => void) {
    this.settings = settings
    this.expandedBounds = settings.bounds
    this.win = new BrowserWindow({
      width: settings.bounds?.width ?? 420,
      height: settings.bounds?.height ?? 640,
      x: settings.bounds?.x,
      y: settings.bounds?.y,
      minWidth: 340,
      minHeight: 360,
      maximizable: false,
      frame: false,
      show: false,
      opacity: settings.opacity,
      alwaysOnTop: settings.alwaysOnTop,
      backgroundColor: '#111820',
      webPreferences: {
        preload: join(__dirname, '../preload/index.cjs'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true
      }
    })
    this.win.setAlwaysOnTop(settings.alwaysOnTop, 'screen-saver')
    this.setClickThrough(settings.clickThrough)
    this.ensureVisible()
    this.win.once('ready-to-show', () => this.win.show())
    this.win.on('moved', () => {
      if (this.applyingBounds) return
      this.scheduleSave()
      this.dockToNearestEdge()
    })
    this.win.on('resize', () => this.scheduleSave())
    this.dockTimer = setInterval(() => this.trackDockHover(), 120)
    if (process.env.ELECTRON_RENDERER_URL) this.win.loadURL(process.env.ELECTRON_RENDERER_URL)
    else this.win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  update(patch: Partial<Settings>) {
    this.settings = this.saveSettings(patch)
    if (patch.opacity !== undefined) this.win.setOpacity(this.settings.opacity)
    if (patch.alwaysOnTop !== undefined) this.win.setAlwaysOnTop(this.settings.alwaysOnTop, 'screen-saver')
    if (patch.clickThrough !== undefined) this.setClickThrough(this.settings.clickThrough)
    this.onSettings(this.settings)
    return this.settings
  }

  setClickThrough(enabled: boolean) {
    this.win.setIgnoreMouseEvents(enabled, { forward: enabled })
  }

  toggleClickThrough() { return this.update({ clickThrough: !this.settings.clickThrough }) }
  show() { this.win.show(); this.win.focus() }
  hide() { this.win.hide() }
  broadcast(channel: string, payload: unknown) {
    if (!this.win.isDestroyed()) this.win.webContents.send(channel, payload)
  }

  private scheduleSave() {
    if (this.applyingBounds || this.settings.dockEdge) return
    clearTimeout(this.saveTimer)
    this.saveTimer = setTimeout(() => {
      if (this.settings.dockEdge) return
      this.expandedBounds = this.win.getBounds()
      this.settings = this.saveSettings({ bounds: this.expandedBounds })
    }, 250)
  }

  dockToNearestEdge() {
    const point = screen.getCursorScreenPoint()
    const area = screen.getDisplayNearestPoint(point).workArea
    const threshold = 24
    let edge: DockEdge = null
    if (Math.abs(point.x - area.x) <= threshold) edge = 'left'
    else if (Math.abs(point.x - area.x - area.width) <= threshold) edge = 'right'
    else if (Math.abs(point.y - area.y) <= threshold) edge = 'top'
    else if (Math.abs(point.y - area.y - area.height) <= threshold) edge = 'bottom'
    if (edge) this.dock(edge)
    else if (this.settings.dockEdge) {
      this.hoverExpanded = false
      this.update({ dockEdge: null })
    }
  }

  private dock(edge: Exclude<DockEdge, null>) {
    if (this.applyingBounds) return
    clearTimeout(this.saveTimer)
    if (this.win.isMaximized()) this.win.unmaximize()
    const normal = this.win.getNormalBounds()
    const area = screen.getDisplayMatching(normal).workArea
    this.expandedBounds = normal.width >= area.width * 0.9 && normal.height >= area.height * 0.9
      ? { x: area.x + area.width - 440, y: area.y + 60, width: 420, height: Math.min(640, area.height - 120) }
      : normal
    this.settings = this.saveSettings({ dockEdge: edge, bounds: this.expandedBounds })
    this.hoverExpanded = false
    this.collapseToEdge()
  }

  private collapseToEdge() {
    const edge = this.settings.dockEdge
    if (!edge || !this.expandedBounds) return
    const display = screen.getDisplayMatching(this.expandedBounds)
    const area = display.workArea
    const size = 10
    const length = 160
    const centerX = this.expandedBounds.x + this.expandedBounds.width / 2
    const centerY = this.expandedBounds.y + this.expandedBounds.height / 2
    let bounds: WindowBounds
    if (edge === 'left' || edge === 'right') {
      bounds = {
        x: edge === 'left' ? area.x : area.x + area.width - size,
        y: Math.max(area.y, Math.min(centerY - length / 2, area.y + area.height - length)),
        width: size, height: length
      }
    } else {
      bounds = {
        x: Math.max(area.x, Math.min(centerX - length / 2, area.x + area.width - length)),
        y: edge === 'top' ? area.y : area.y + area.height - size,
        width: length, height: size
      }
    }
    this.applyingBounds = true
    this.win.setMinimumSize(10, 10)
    this.win.setBounds(bounds)
    this.applyingBounds = false
  }

  private trackDockHover() {
    if (!this.settings.dockEdge || this.win.isDestroyed()) return
    const point = screen.getCursorScreenPoint()
    const bounds = this.win.getBounds()
    const near = point.x >= bounds.x - 8 && point.x <= bounds.x + bounds.width + 8
      && point.y >= bounds.y - 8 && point.y <= bounds.y + bounds.height + 8
    if (near && !this.hoverExpanded) {
      this.hoverExpanded = true
      this.applyingBounds = true
      this.win.setMinimumSize(340, 360)
      if (this.expandedBounds) this.win.setBounds(this.expandedBounds)
      this.applyingBounds = false
    }
    if (this.hoverExpanded && !near) {
      if (!this.outsideSince) this.outsideSince = Date.now()
      if (Date.now() - this.outsideSince > 800) {
        this.hoverExpanded = false
        this.outsideSince = 0
        this.collapseToEdge()
      }
    } else this.outsideSince = 0
  }

  private ensureVisible() {
    const bounds = this.win.getBounds()
    const area = screen.getDisplayMatching(bounds).workArea
    if (bounds.x < area.x || bounds.y < area.y || bounds.x >= area.x + area.width || bounds.y >= area.y + area.height) {
      this.win.center()
    }
  }

  async destroy() {
    clearTimeout(this.saveTimer)
    clearInterval(this.dockTimer)
    if (!this.win.isDestroyed()) this.win.destroy()
  }
}
