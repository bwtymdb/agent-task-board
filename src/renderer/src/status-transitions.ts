import type { Light, TaskItem } from '../../shared/types.ts'

export function changedAlertLights(previous: ReadonlyMap<string, Light>, tasks: Pick<TaskItem, 'key' | 'light'>[]) {
  return tasks.flatMap(task => {
    const before = previous.get(task.key)
    return before === 'yellow' && task.light !== 'yellow' ? [task.light] : []
  })
}
