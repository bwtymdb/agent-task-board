import type { TaskItem } from '../../../shared/types.ts'

const shortNames = { 'kimi-code': 'KC', workbuddy: 'WB', 'kimi-work': 'KW' }

export function MiniDock({ tasks }: { tasks: TaskItem[] }) {
  const focused = tasks.filter(task => task.focused && !task.archived)
  const visible = focused.slice(0, 8)
  return <main className="mini-dock" title="重点监控 · 鼠标靠近展开">
    <div className="mini-dock-title"><span>重点监控</span><strong>{focused.length}</strong></div>
    {visible.map((task, index) => <div className="mini-task" key={task.key}>
      <span className="mini-index">{String(index + 1).padStart(2, '0')}</span>
      <span className="mini-platform">{shortNames[task.platform]}</span>
      <span className={`mini-light ${task.light}`} title={task.reason} />
    </div>)}
    {focused.length === 0 && <div className="mini-empty">暂无星标任务</div>}
    {focused.length > 8 && <div className="mini-more">另有 {focused.length - 8} 项</div>}
  </main>
}
