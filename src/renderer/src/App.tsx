import { useEffect, useMemo, useState } from 'react'
import type { BoardSnapshot, Light, Settings } from '../../shared/types.ts'
import { TaskRow } from './components/TaskRow.tsx'
import { SettingsPanel } from './components/SettingsPanel.tsx'

const emptySnapshot: BoardSnapshot = { tasks: [], health: [], updatedAt: Date.now() }

export default function App() {
  const [snapshot, setSnapshot] = useState<BoardSnapshot>(emptySnapshot)
  const [settings, setSettings] = useState<Settings | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [filter, setFilter] = useState<'all' | Light>('all')
  const [platform, setPlatform] = useState('all')
  const [query, setQuery] = useState('')
  const [showArchived, setShowArchived] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [manualTitle, setManualTitle] = useState('')
  const [manualUrl, setManualUrl] = useState('')
  const [message, setMessage] = useState('')
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    if (!window.board) { setMessage('预加载桥接未就绪，请重启看板。'); return }
    Promise.all([window.board.getSnapshot(), window.board.getSettings()]).then(([nextSnapshot, nextSettings]) => {
      setSnapshot(nextSnapshot)
      setSettings(nextSettings)
      setLoaded(true)
    }).catch(error => setMessage(error instanceof Error ? error.message : String(error)))
    const offSnapshot = window.board.onSnapshot(setSnapshot)
    const offSettings = window.board.onSettings(setSettings)
    return () => { offSnapshot(); offSettings() }
  }, [])

  const activeTasks = useMemo(() => snapshot.tasks.filter(task => !task.archived), [snapshot.tasks])
  const counts = useMemo(() => ({
    red: activeTasks.filter(task => task.light === 'red').length,
    yellow: activeTasks.filter(task => task.light === 'yellow').length,
    green: activeTasks.filter(task => task.light === 'green').length
  }), [activeTasks])
  const visibleTasks = useMemo(() => snapshot.tasks.filter(task => {
    if (task.archived !== showArchived) return false
    if (filter !== 'all' && task.light !== filter) return false
    if (platform !== 'all' && task.platform !== platform) return false
    const haystack = `${task.title} ${task.cwd || ''}`.toLocaleLowerCase('zh-CN')
    return haystack.includes(query.trim().toLocaleLowerCase('zh-CN'))
  }), [snapshot.tasks, filter, platform, query, showArchived])

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
  const updateTaskSettings = (next: Settings) => setSettings(next)

  return <main className={`board-shell ${settings?.clickThrough ? 'through' : ''}`}>
    <header className="board-header" onMouseUp={() => window.board.dockWindow()}>
      <div className="brand-block"><span className="brand-mark"><i /><i /><i /></span><div><h1>任务看板</h1><p>AI WORK CONTROL</p></div></div>
      <div className="header-actions">
        <button className="icon-button" title="刷新" onClick={() => run(async () => {
          setRefreshing(true)
          setSnapshot(await window.board.refresh())
          setRefreshing(false)
        })}>{refreshing ? '·' : '↻'}</button>
        <button className={`icon-button ${settingsOpen ? 'selected' : ''}`} title="设置" onClick={() => setSettingsOpen(value => !value)}>⚙</button>
        <button className="icon-button" title="隐藏到托盘" onClick={() => window.board.hideWindow()}>—</button>
      </div>
    </header>

    <section className="status-strip" aria-label="状态统计">
      {(['red', 'yellow', 'green'] as Light[]).map(light => <button key={light} className={`${light} ${filter === light ? 'selected' : ''}`} onClick={() => setFilter(current => current === light ? 'all' : light)}>
        <span className={`light ${light} active`} /><strong>{counts[light]}</strong><small>{light === 'red' ? '需处理' : light === 'yellow' ? '进行中' : '空闲'}</small>
      </button>)}
    </section>

    <section className="filter-bar">
      <input className="search-input" value={query} onChange={event => setQuery(event.target.value)} placeholder="搜索任务或项目" aria-label="搜索任务或项目" />
      <select value={platform} onChange={event => setPlatform(event.target.value)} aria-label="平台筛选">
        <option value="all">全部平台</option><option value="kimi-code">Kimi Code</option><option value="workbuddy">WorkBuddy</option><option value="kimi-work">Kimi Work</option><option value="manual">手动任务</option>
      </select>
    </section>
    <div className="list-toolbar">
      <span>{showArchived ? '已归档' : `${visibleTasks.length} 项任务`}</span>
      <div><button className={showArchived ? 'selected' : ''} onClick={() => setShowArchived(value => !value)}>归档</button><button onClick={() => setAddOpen(value => !value)}>＋ 手动</button></div>
    </div>

    {addOpen && <form className="manual-form" onSubmit={event => {
      event.preventDefault()
      run(async () => {
        updateTaskSettings(await window.board.addManualTask(manualTitle, manualUrl))
        setManualTitle(''); setManualUrl(''); setAddOpen(false)
      }, '已添加手动任务')
    }}>
      <input required maxLength={200} value={manualTitle} onChange={event => setManualTitle(event.target.value)} placeholder="任务名称" />
      <input required type="url" value={manualUrl} onChange={event => setManualUrl(event.target.value)} placeholder="https://…" />
      <div><button type="button" onClick={() => setAddOpen(false)}>取消</button><button type="submit" className="action-primary">添加任务</button></div>
    </form>}
    {message && <button className="toast" onClick={() => setMessage('')}>{message}<span>×</span></button>}

    <section className="task-list">
      {visibleTasks.map(task => <TaskRow key={task.key} task={task}
        onOpen={() => run(async () => {
          const result = await window.board.openTask(task.key)
          setMessage(result.message)
        })}
        onRename={title => run(async () => updateTaskSettings(await window.board.renameTask(task.key, title)), '标题已更新')}
        onArchive={() => run(async () => updateTaskSettings(await window.board.archiveTask(task.key, !task.archived)))}
        onOverride={light => run(async () => updateTaskSettings(await window.board.overrideTask(task.key, light)))}
        onRemove={() => run(async () => updateTaskSettings(await window.board.removeManualTask(task.nativeId)), '手动任务已删除')}
      />)}
      {loaded && visibleTasks.length === 0 && <div className="empty-state"><span className="empty-lights"><i /><i /><i /></span><h2>{showArchived ? '没有归档任务' : query || filter !== 'all' || platform !== 'all' ? '没有匹配的任务' : '等待发现任务'}</h2><p>{showArchived ? '归档的会话会集中显示在这里。' : '启动三个平台中的会话后，任务会自动出现在这里。'}</p>{!query && filter === 'all' && platform === 'all' && <button onClick={() => setAddOpen(true)}>添加手动任务</button>}</div>}
    </section>

    <footer className="board-footer"><span><i className={`sync-dot ${snapshot.health.some(item => !item.connected) ? 'warning' : ''}`} />本地只读监控</span><span>{new Date(snapshot.updatedAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</span></footer>

    {settingsOpen && settings && <SettingsPanel settings={settings} health={snapshot.health} onUpdate={updateSettings} onClose={() => setSettingsOpen(false)} message={message} onInstallHooks={() => run(async () => {
      const result = await window.board.installKimiHooks()
      setMessage(result.message)
    })} />}
  </main>
}
