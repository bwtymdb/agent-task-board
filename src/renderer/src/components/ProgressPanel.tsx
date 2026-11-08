import type { ProgressDay, ProgressEntry, TaskProgress } from '../../../shared/types.ts'

const statusNames = { completed: '当日目标已完成', 'in-progress': '仍有遗留', blocked: '需要处理' }

function dayLabel(timestamp: number | null) {
  if (timestamp === null) return '时间未记录'
  return new Date(timestamp).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' })
}

function reportDate(date: string | null) {
  if (!date) return '时间未记录'
  return new Date(`${date}T00:00:00`).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' })
}

function groupByDay(entries: ProgressEntry[]) {
  const groups = new Map<string, ProgressEntry[]>()
  for (const entry of entries) {
    const day = dayLabel(entry.timestamp)
    groups.set(day, [...(groups.get(day) || []), entry])
  }
  return [...groups]
}

function DailyReport({ day }: { day: ProgressDay }) {
  const groups = [
    { title: '当天完成', items: day.completed },
    { title: '遗留问题', items: day.pending },
    { title: '后续建议', items: day.suggestions }
  ]
  return <article className={`daily-report ${day.status}`}>
    <div className="daily-report-head"><strong>{reportDate(day.date)}</strong><span className={`daily-status ${day.status}`}>{statusNames[day.status]}</span></div>
    <p className="daily-overview">{day.overview}</p>
    {groups.map(group => group.items.length > 0 && <section className="daily-group" key={group.title}><h3>{group.title}</h3><ul>{group.items.map(item => <li key={item}>{item}</li>)}</ul></section>)}
    {day.files.length > 0 && <div className="daily-files">涉及 {day.files.length} 个文件</div>}
  </article>
}

export function ProgressPanel({ progress, loading, error, onClose, standalone = false }: { progress?: TaskProgress; loading: boolean; error: string; onClose: () => void; standalone?: boolean }) {
  if (loading) return <section className={`progress-panel ${standalone ? 'standalone' : ''}`}><p className="progress-empty">正在按天理解对话并整理工作总结…</p></section>
  return <section className={`progress-panel ${standalone ? 'standalone' : ''}`} aria-label="任务进展日志">
    {!standalone && <div className="progress-heading"><strong>进展日志</strong><button onClick={onClose} aria-label="收起进展日志">收起</button></div>}
    {error && <p className="progress-error">{error}</p>}
    {progress?.notice && <p className="progress-notice">{progress.notice}</p>}
    {progress && !progress.entries.length && !progress.days?.length && <p className="progress-empty">暂时没有可显示的进展记录。</p>}
    {progress?.days?.map(day => <DailyReport key={day.date || 'unrecorded'} day={day} />)}
    {!progress?.days && progress && groupByDay(progress.entries).map(([day, entries]) => <div className="progress-day" key={day}>
      <div className="progress-date"><strong>{day}</strong><span>{entries.length} 次推进</span></div>
      {entries.map(entry => <article className="progress-entry" key={entry.id}>
        <div className="progress-entry-top">
          <strong>{entry.summary}</strong>
          {entry.timestamp !== null && <time dateTime={new Date(entry.timestamp).toISOString()}>{new Date(entry.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</time>}
        </div>
        {entry.result && <p>{entry.result}</p>}
        {entry.files.length > 0 && <div className="progress-files">{entry.files.slice(0, 6).map(file => <span key={file}>{file}</span>)}{entry.files.length > 6 && <span>另 {entry.files.length - 6} 个文件</span>}</div>}
      </article>)}
    </div>)}
  </section>
}
