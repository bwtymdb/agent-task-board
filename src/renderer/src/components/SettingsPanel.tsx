import { useState } from 'react'
import type { ConnectorHealth, Settings } from '../../../shared/types.ts'

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
        <p className="setting-note">自定义目录在重启看板后生效。所有源数据均以只读方式使用。</p>
      </div>}
    </div>
  </section>
}
