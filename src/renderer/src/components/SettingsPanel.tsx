import { useState } from 'react'
import type { ConnectorHealth, Settings, ThemeName } from '../../../shared/types.ts'

const themes: { id: ThemeName; name: string; color: string }[] = [
  { id: 'midnight', name: '午夜', color: '#111820' },
  { id: 'yellow', name: '便签黄', color: '#fff0a6' },
  { id: 'mint', name: '薄荷绿', color: '#cdeed9' },
  { id: 'sky', name: '天空蓝', color: '#cce5f6' },
  { id: 'lavender', name: '薰衣草', color: '#e4d9f2' },
  { id: 'rose', name: '樱花粉', color: '#f6d9dc' }
]

type Props = {
  settings: Settings
  health: ConnectorHealth[]
  onUpdate: (patch: Partial<Settings>) => void
  onInstallHooks: () => void
  onClose: () => void
  message: string
}

export function SettingsPanel({ settings, health, onUpdate, onInstallHooks, onClose, message }: Props) {
  const [pathsOpen, setPathsOpen] = useState(false)
  return <section className="settings-panel" aria-label="看板设置">
    <header className="panel-header">
      <div><span className="eyebrow">CONTROL</span><h2>看板设置</h2></div>
      <button className="icon-button" onClick={onClose} aria-label="关闭设置">×</button>
    </header>
    <div className="settings-scroll">
      <div className="setting-block">
        <div className="setting-label"><span>窗口透明度</span><output>{Math.round(settings.opacity * 100)}%</output></div>
        <input type="range" min="0.3" max="1" step="0.05" value={settings.opacity} onChange={event => onUpdate({ opacity: Number(event.target.value) })} />
      </div>
      <div className="setting-block theme-block">
        <div className="setting-label"><span>便签配色</span></div>
        <div className="theme-options" role="radiogroup" aria-label="便签配色">
          {themes.map(theme => <button key={theme.id} className={settings.theme === theme.id ? 'selected' : ''} onClick={() => onUpdate({ theme: theme.id })} role="radio" aria-checked={settings.theme === theme.id}>
            <i style={{ background: theme.color }} /><span>{theme.name}</span>
          </button>)}
        </div>
      </div>
      <div className="setting-block open-target-setting">
        <label className="setting-label" htmlFor="kimi-open-target">Kimi Code 打开方式</label>
        <select id="kimi-open-target" value={settings.kimiCodeOpenTarget} onChange={event => onUpdate({ kimiCodeOpenTarget: event.target.value as Settings['kimiCodeOpenTarget'] })}>
          <option value="desktop">桌面端优先</option>
          <option value="cli">CMD 优先</option>
        </select>
        <p className="setting-note">桌面端会按完整会话标题定位；找不到时明确提示，不自动改开 CMD。其他平台目前使用已验证的桌面入口。</p>
      </div>
      <label className="toggle-row"><span><strong>窗口置顶</strong><small>始终显示在普通窗口上方</small></span><input type="checkbox" checked={settings.alwaysOnTop} onChange={event => onUpdate({ alwaysOnTop: event.target.checked })} /></label>
      <label className="toggle-row"><span><strong>鼠标穿透</strong><small>点击落到下层应用 · Ctrl+Alt+Space 恢复</small></span><input type="checkbox" checked={settings.clickThrough} onChange={event => onUpdate({ clickThrough: event.target.checked })} /></label>
      <label className="toggle-row"><span><strong>开机启动</strong><small>登录 Windows 后启动看板</small></span><input type="checkbox" checked={settings.autoStart} onChange={event => onUpdate({ autoStart: event.target.checked })} /></label>

      <h3 className="section-title">平台连接</h3>
      <div className="health-list">
        {health.map(item => <div className="health-row" key={item.platform}>
          <span className={`health-dot ${item.connected ? 'connected' : ''}`} />
          <div><strong>{item.platform === 'kimi-code' ? 'Kimi Code' : item.platform === 'workbuddy' ? 'WorkBuddy' : 'Kimi Work'}</strong><small>{item.detail}</small></div>
        </div>)}
      </div>
      <button className="wide-button" onClick={onInstallHooks}>配置 / 修复 Kimi Code Hooks</button>
      <p className="setting-note">只追加上报 Hook，不覆盖已有配置；新会话自动生效。</p>
      {message && <p className="inline-message">{message}</p>}
      <button className="text-button" onClick={() => setPathsOpen(value => !value)}>{pathsOpen ? '收起数据目录' : '数据目录与故障排查'}</button>
      {pathsOpen && <div className="path-settings">
        <label>Kimi Code 数据目录<input defaultValue={settings.kimiCodeHome || ''} placeholder="%USERPROFILE%\.kimi-code" onBlur={event => onUpdate({ kimiCodeHome: event.target.value || undefined })} /></label>
        <label>WorkBuddy 数据库<input defaultValue={settings.workbuddyDb || ''} placeholder="%USERPROFILE%\.workbuddy\workbuddy.db" onBlur={event => onUpdate({ workbuddyDb: event.target.value || undefined })} /></label>
        <label>Kimi Work 状态文件<input defaultValue={settings.kimiWorkStatusFile || ''} placeholder="%APPDATA%\kimi-desktop\kimi-agent\conversation-statuses.json" onBlur={event => onUpdate({ kimiWorkStatusFile: event.target.value || undefined })} /></label>
        <p className="setting-note">自定义目录在重启看板后生效。监控保持只读，只有你主动重命名或归档时才执行受限回写。</p>
      </div>}
    </div>
  </section>
}
