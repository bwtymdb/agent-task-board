import type { ProgressEntry, TaskProgress } from '../../../shared/types.ts'

function dayLabel(timestamp: number | null) {
  if (timestamp === null) return '时间未记录'
  return new Date(timestamp).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' })
}

function groupByDay(entries: ProgressEntry[]) {
  const groups = new Map<string, ProgressEntry[]>()
  for (const entry of entries) {
    const day = dayLabel(entry.timestamp)
    groups.set(day, [...(groups.get(day) || []), entry])
  }
  return [...groups]
}

export function ProgressPanel({ progress, loading, error, onClose, standalone = false }: { progress?: TaskProgress; loading: boolean; error: string; onClose: () => void; standalone?: boolean }) {
  return <section className={`progress-panel ${standalone ? 'standalone' : ''}`} aria-label="任务进展日志">
    {!standalone && <div className="progress-heading"><strong>进展日志</strong><button onClick={onClose} aria-label="收起进展日志">收起</button></div>}
    {loading && <p className="progress-empty">正在读取本机会话记录…</p>}
    {error && <p className="progress-error">{error}</p>}
    {progress?.notice && <p className="progress-notice">{progress.notice}</p>}
    {progress && !loading && progress.entries.length === 0 && <p className="progress-empty">暂时没有可显示的进展记录。</p>}
    {progress && groupByDay(progress.entries).map(([day, entries]) => <div className="progress-day" key={day}>
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
