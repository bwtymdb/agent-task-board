import { useEffect, useMemo, useState } from 'react'
import type { BoardSnapshot, DockState, Light, Settings } from '../../shared/types.ts'
import { TaskRow } from './components/TaskRow.tsx'
import { SettingsPanel } from './components/SettingsPanel.tsx'
import { MiniDock } from './components/MiniDock.tsx'

const emptySnapshot: BoardSnapshot = { tasks: [], health: [], updatedAt: Date.now() }

export default function App() {
  const [snapshot, setSnapshot] = useState<BoardSnapshot>(emptySnapshot)
  const [settings, setSettings] = useState<Settings | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [view, setView] = useState<'focus' | 'all' | 'archived'>('all')
  const [expandedKey, setExpandedKey] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | Light>('all')
  const [platform, setPlatform] = useState('all')
  const [query, setQuery] = useState('')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const [dockState, setDockState] = useState<DockState>({ collapsed: false, edge: null })

  useEffect(() => {
    if (!window.board) { setMessage('预加载桥接未就绪，请重启看板。'); return }
    Promise.all([window.board.getSnapshot(), window.board.getSettings()]).then(([nextSnapshot, nextSettings]) => {
      setSnapshot(nextSnapshot)
      setSettings(nextSettings)
      setLoaded(true)
    }).catch(error => setMessage(error instanceof Error ? error.message : String(error)))
    const offSnapshot = window.board.onSnapshot(setSnapshot)
    const offSettings = window.board.onSettings(setSettings)
    const offDock = window.board.onDockState(setDockState)
    return () => { offSnapshot(); offSettings(); offDock() }
  }, [])

  useEffect(() => { setExpandedKey(null) }, [view, filter, platform, query])

  const pageTasks = useMemo(() => snapshot.tasks.filter(task => {
    if (view === 'archived') return task.archived
    if (task.archived) return false
    return view !== 'focus' || task.focused
  }), [snapshot.tasks, view])
  const counts = useMemo(() => ({
    red: pageTasks.filter(task => task.light === 'red').length,
    yellow: pageTasks.filter(task => task.light === 'yellow').length,
    green: pageTasks.filter(task => task.light === 'green').length
  }), [pageTasks])
  const visibleTasks = useMemo(() => pageTasks.filter(task => {
    if (filter !== 'all' && task.light !== filter) return false
    if (platform !== 'all' && task.platform !== platform) return false
    const haystack = `${task.title} ${task.cwd || ''}`.toLocaleLowerCase('zh-CN')
    return haystack.includes(query.trim().toLocaleLowerCase('zh-CN'))
  }), [pageTasks, filter, platform, query])

  async function run(action: () => Promise<unknown>, success?: string) {
    try {
      await action()
      if (success) setMessage(success)
    } catch (error) { setMessage(error instanceof Error ? error.message : String(error)) }
  }
  const updateSettings = (patch: Partial<Settings>) => run(async () => {
    if (patch.clickThrough !== undefined && settings && patch.clickThrough !== settings.clickThrough) {
      setMessage(patch.clickThrough ? '穿透已开启 · 按 Ctrl+Alt+Space 恢复操作' : '鼠标穿透已关闭')
    }
    setSettings(await window.board.updateSettings(patch))
  })
  const showResult = (result: { ok: boolean; message: string }) => setMessage(result.message)

  if (dockState.collapsed) return <div data-theme={settings?.theme || 'midnight'}><MiniDock tasks={snapshot.tasks} /></div>

  return <main className={`board-shell ${settings?.clickThrough ? 'through' : ''}`} data-theme={settings?.theme || 'midnight'}>
    <header className="board-header" onMouseUp={() => window.board.dockWindow()}>
      <div className="brand-block"><span className="brand-mark"><i /><i /><i /></span><div><h1>任务看板</h1><p>AI WORK CONTROL</p></div></div>
      <div className="header-actions">
        <button className="icon-button" title="刷新" onClick={() => run(async () => {
          setRefreshing(true)
          try { setSnapshot(await window.board.refresh()) } finally { setRefreshing(false) }
        })}>{refreshing ? '·' : '↻'}</button>
        <button className={`icon-button ${settingsOpen ? 'selected' : ''}`} title="设置" onClick={() => setSettingsOpen(value => !value)}>⚙</button>
        <button className="icon-button" title="隐藏到托盘" onClick={() => window.board.hideWindow()}>—</button>
      </div>
    </header>

    <nav className="view-tabs" aria-label="任务页面">
      <button className={view === 'focus' ? 'active' : ''} onClick={() => setView('focus')}>重点监控 <span>{snapshot.tasks.filter(task => task.focused && !task.archived).length}</span></button>
      <button className={view === 'all' ? 'active' : ''} onClick={() => setView('all')}>全部对话</button>
      <button className={view === 'archived' ? 'active' : ''} onClick={() => setView('archived')}>归档会话 <span>{snapshot.tasks.filter(task => task.archived).length}</span></button>
    </nav>

    <section className="status-strip" aria-label="状态统计">
      {(['red', 'yellow', 'green'] as Light[]).map(light => <button key={light} className={`${light} ${filter === light ? 'selected' : ''}`} onClick={() => setFilter(current => current === light ? 'all' : light)}>
        <span className={`light ${light} active`} /><strong>{counts[light]}</strong><small>{light === 'red' ? '需处理' : light === 'yellow' ? '进行中' : '空闲'}</small>
      </button>)}
    </section>

    <section className="filter-bar">
      <input className="search-input" value={query} onChange={event => setQuery(event.target.value)} placeholder="搜索任务或项目" aria-label="搜索任务或项目" />
      <select value={platform} onChange={event => setPlatform(event.target.value)} aria-label="平台筛选">
        <option value="all">全部平台</option><option value="kimi-code">Kimi Code</option><option value="workbuddy">WorkBuddy</option><option value="kimi-work">Kimi Work</option>
      </select>
    </section>
    <div className="list-toolbar">
      <span>{view === 'focus' ? `${visibleTasks.length} 项重点任务` : view === 'archived' ? `${visibleTasks.length} 项归档会话` : `${visibleTasks.length} 项任务`}</span>
      {filter !== 'all' && <button className="clear-filter" onClick={() => setFilter('all')}>全部状态</button>}
    </div>

    {message && <button className="toast" onClick={() => setMessage('')}>{message}<span>×</span></button>}

    <section className="task-list">
      {visibleTasks.map(task => <TaskRow key={task.key} task={task}
        expanded={expandedKey === task.key}
        onToggle={() => setExpandedKey(current => current === task.key ? null : task.key)}
        onOpen={() => run(async () => showResult(await window.board.openTask(task.key)))}
        onRename={title => run(async () => showResult(await window.board.renameTask(task.key, title)))}
        onArchive={() => run(async () => showResult(await window.board.archiveTask(task.key, !task.archived)))}
        onFocus={() => run(async () => setSettings(await window.board.toggleFocus(task.key)))}
        onCancelBackground={taskId => run(async () => showResult(await window.board.cancelBackgroundTask(task.key, taskId)))}
      />)}
      {loaded && visibleTasks.length === 0 && <div className="empty-state"><span className="empty-lights"><i /><i /><i /></span><h2>{view === 'focus' ? '还没有重点任务' : view === 'archived' ? '没有归档会话' : '没有匹配的任务'}</h2><p>{view === 'focus' ? '在“全部对话”中点星标，把正在处理的工作加入这里。' : '切换筛选条件，或回到其他页面查看。'}</p>{view === 'focus' && <button onClick={() => setView('all')}>去全部对话选择</button>}</div>}
    </section>

    <footer className="board-footer"><span><i className={`sync-dot ${snapshot.health.some(item => !item.connected) ? 'warning' : ''}`} />平台状态 · 自动更新</span><span>{new Date(snapshot.updatedAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</span></footer>

    {settingsOpen && settings && <SettingsPanel settings={settings} health={snapshot.health} onUpdate={updateSettings} onClose={() => setSettingsOpen(false)} message={message} onInstallHooks={() => run(async () => {
      const result = await window.board.installKimiHooks()
      setMessage(result.message)
    })} />}
  </main>
}
