import { useState } from 'react'
import type { Light, TaskItem } from '../../../shared/types.ts'

const platformNames = { 'kimi-code': 'Kimi Code', workbuddy: 'WorkBuddy', 'kimi-work': 'Kimi Work' }
const lightNames = { red: '需处理', yellow: '进行中', green: '空闲' }

function relativeTime(timestamp: number) {
  const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000))
  if (seconds < 60) return '刚刚'
  if (seconds < 3600) return `${Math.floor(seconds / 60)} 分钟前`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} 小时前`
  return `${Math.floor(seconds / 86400)} 天前`
}

type Props = {
  task: TaskItem
  expanded: boolean
  onToggle: () => void
  onOpen: () => void
  onRename: (title: string) => void
  onArchive: () => void
  onFocus: () => void
}

export function TaskRow({ task, expanded, onToggle, onOpen, onRename, onArchive, onFocus }: Props) {
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(task.title)
  const directory = task.cwd?.replaceAll('\\', '/').split('/').filter(Boolean).at(-1)
  return <article className={`task-row ${task.light} ${task.stale ? 'stale' : ''}`} data-task-key={task.key}>
    <div className="task-main">
      <button className={`focus-button ${task.focused ? 'focused' : ''}`} title={task.focused ? '移出重点监控' : '加入重点监控'} aria-label={task.focused ? '移出重点监控' : '加入重点监控'} onClick={onFocus}>★</button>
      <div className="task-select" role="button" tabIndex={0} title="双击打开会话" onDoubleClick={onOpen} onClick={onToggle} onKeyDown={event => {
        if (event.key === 'Enter' || event.key === ' ') onToggle()
      }} aria-expanded={expanded}>
        <span className="task-topline">
          <span className={`platform-badge ${task.platform}`}>{platformNames[task.platform]}</span>
          <span className="task-time">{relativeTime(task.updatedAt)}</span>
          {task.unread && <span className="unread-badge">未读</span>}
          {task.stale && <span className="stale-badge">待核对</span>}
        </span>
        {editing ? <span className="rename-line" onClick={event => event.stopPropagation()}>
          <input value={title} maxLength={200} autoFocus onChange={event => setTitle(event.target.value)} onKeyDown={event => {
            if (event.key === 'Enter' && title.trim()) { onRename(title); setEditing(false) }
            if (event.key === 'Escape') setEditing(false)
          }} />
          <button onClick={() => { if (title.trim()) { onRename(title); setEditing(false) } }}>保存</button>
        </span> : <strong className="task-title" title={task.title}>{task.title}</strong>}
        <span className="task-reason">{task.reason}{directory ? ` · ${directory}` : ''}</span>
      </div>
      <div className="light-cluster" aria-label={lightNames[task.light]}>
        {(['red', 'yellow', 'green'] as Light[]).map(light => <span key={light} className={`light ${light} ${task.light === light ? 'active' : ''}`} />)}
        <span className="light-name">{lightNames[task.light]}</span>
      </div>
    </div>
    {expanded && <div className="task-actions">
      <button className="action-primary" onClick={onOpen}>{task.platform === 'kimi-work' ? '打开平台' : '打开原对话'}</button>
      <button onClick={() => { setTitle(task.title); setEditing(true) }}>{task.platform === 'kimi-work' ? '看板别名' : '同步重命名'}</button>
      {task.platform !== 'kimi-work' && <button className={`archive-button ${task.archived ? 'archived' : ''}`} onClick={onArchive}>{task.archived ? '取消归档' : '平台归档'}</button>}
    </div>}
  </article>
}
