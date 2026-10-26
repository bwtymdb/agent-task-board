import type { ManualTask, TaskItem } from '../../shared/types.ts'

export function manualTaskItems(tasks: ManualTask[]): TaskItem[] {
  return tasks.map(task => ({
    key: `manual:${task.id}`, nativeId: task.id, platform: 'manual', title: task.title,
    light: task.light, reason: '手动任务', updatedAt: Date.now(), archived: false,
    unread: false, stale: false, url: task.url
  }))
}
