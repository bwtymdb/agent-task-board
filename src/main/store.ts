import { copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import type { Settings } from '../shared/types.ts'

export const defaultSettings: Settings = {
  opacity: 0.9,
  alwaysOnTop: true,
  clickThrough: false,
  autoStart: false,
  dockEdge: null,
  aliases: {},
  archived: {},
  overrides: {},
  manualTasks: []
}

export class LocalStore {
  private settings: Settings = { ...defaultSettings }

  constructor(private readonly filePath: string) {}

  load() {
    if (existsSync(this.filePath)) {
      try {
        const saved = JSON.parse(readFileSync(this.filePath, 'utf8')) as Partial<Settings>
        this.settings = this.normalize({ ...defaultSettings, ...saved })
      } catch {
        copyFileSync(this.filePath, `${this.filePath}.corrupt-${Date.now()}`)
        this.settings = { ...defaultSettings }
      }
    }
    return this.settings
  }

  update(patch: Partial<Settings>) {
    this.settings = this.normalize({ ...this.settings, ...patch })
    this.save()
    return this.settings
  }

  private normalize(settings: Settings): Settings {
    return {
      ...settings,
      opacity: Math.min(1, Math.max(0.3, Number(settings.opacity) || 0.9)),
      aliases: settings.aliases ?? {},
      archived: settings.archived ?? {},
      overrides: settings.overrides ?? {},
      manualTasks: Array.isArray(settings.manualTasks) ? settings.manualTasks : []
    }
  }

  private save() {
    mkdirSync(dirname(this.filePath), { recursive: true })
    const temp = join(dirname(this.filePath), `settings-${process.pid}.tmp`)
    writeFileSync(temp, JSON.stringify(this.settings, null, 2), 'utf8')
    renameSync(temp, this.filePath)
  }
}
