import { useEffect, useState } from 'react'
import type { Settings, TaskItem, TaskProgress } from '../../../shared/types.ts'
import { ProgressPanel } from './ProgressPanel.tsx'

const platformNames = { 'kimi-code': 'Kimi Code', workbuddy: 'WorkBuddy', 'kimi-work': 'Kimi Work', 'deepseek-harness': 'DeepSeek Harness' }

export function ProgressWindow({ taskKey }: { taskKey: string }) {
  const [task, setTask] = useState<TaskItem>()
  const [settings, setSettings] = useState<Settings>()
  const [progress, setProgress] = useState<TaskProgress>()
  const [error, setError] = useState('')
  const [summarizing, setSummarizing] = useState(false)

  useEffect(() => {
    Promise.all([window.board.getSnapshot(), window.board.getSettings(), window.board.getProgress(taskKey)])
      .then(([snapshot, nextSettings, nextProgress]) => {
        const current = snapshot.tasks.find(item => item.key === taskKey)
        setTask(current)
        setSettings(nextSettings)
        setProgress(nextProgress)
        document.title = `任务进展 - ${current?.title || '未命名会话'}`
      }).catch(reason => setError(reason instanceof Error ? reason.message : String(reason)))
  }, [taskKey])

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') window.board.closeProgress() }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [])

  async function summarize() {
    setSummarizing(true); setError('')
    try { setProgress(await window.board.summarizeProgress(taskKey)) }
    catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)) }
    finally { setSummarizing(false) }
  }

  return <main className="progress-window" data-theme={settings?.theme || 'midnight'}>
    <header className="progress-window-header">
      <div><span className="eyebrow">PROGRESS LOG</span><h1>{task?.title || '任务进展'}</h1>{task && <p>{platformNames[task.platform]} · {progress?.ai ? `AI 每日总结 · ${progress.ai.model}` : '本地记录 · 可生成 AI 每日总结'}</p>}</div>
      <div className="progress-window-actions"><button className="ai-summary-button" disabled={summarizing} onClick={() => void summarize()}>{summarizing ? 'AI 分析中…' : 'AI 每日总结'}</button><button onClick={() => window.board.closeProgress()} title="按 Esc 也可关闭">关闭 <span>Esc</span></button></div>
    </header>
    <div className="progress-window-body">
      <ProgressPanel progress={progress} loading={summarizing || (!progress && !error)} error={error} standalone onClose={() => window.board.closeProgress()} />
    </div>
  </main>
}
