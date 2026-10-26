import { useState } from 'react'
import type { Light, TaskItem } from '../../../shared/types.ts'

const platformNames = { 'kimi-code': 'Kimi Code', workbuddy: 'WorkBuddy', 'kimi-work': 'Kimi Work', manual: '手动' }
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
  onOpen: () => void
  onRename: (title: string) => void
  onArchive: () => void
  onOverride: (light?: Light) => void
  onRemove: () => void
}

export function TaskRow({ task, onOpen, onRename, onArchive, onOverride, onRemove }: Props) {
  const [expanded, setExpanded] = useState(false)
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(task.title)
  const directory = task.cwd?.replaceAll('\\', '/').split('/').filter(Boolean).at(-1)
  return <article className={`task-row ${task.light} ${task.stale ? 'stale' : ''}`}>
    <div className="task-main">
      <div className="task-select" role="button" tabIndex={0} onClick={() => setExpanded(value => !value)} onKeyDown={event => {
        if (event.key === 'Enter' || event.key === ' ') setExpanded(value => !value)
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
      <button className="action-primary" onClick={onOpen}>{task.platform === 'kimi-code' ? '打开原对话' : task.platform === 'manual' ? '打开链接' : '打开平台'}</button>
      <button onClick={() => { setTitle(task.title); setEditing(true) }}>重命名</button>
      <button onClick={onArchive}>{task.archived ? '移出归档' : '归档'}</button>
      <div className="override-actions">
        <span>状态</span>
        {(['red', 'yellow', 'green'] as Light[]).map(light => <button key={light} className={task.manualOverride === light ? 'selected' : ''} onClick={() => onOverride(light)}>{lightNames[light]}</button>)}
        {task.manualOverride && <button onClick={() => onOverride(undefined)}>恢复自动</button>}
      </div>
      {task.platform === 'manual' && <button className="danger-link" onClick={onRemove}>删除手动任务</button>}
    </div>}
  </article>
}
