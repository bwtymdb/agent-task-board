import type { Light, Platform, TaskItem } from './types.ts'

export const statusPriority: Record<Light, number> = { red: 0, yellow: 1, green: 2 }

export function compareTasks(a: TaskItem, b: TaskItem) {
  return statusPriority[a.light] - statusPriority[b.light]
    || b.updatedAt - a.updatedAt
    || a.title.localeCompare(b.title, 'zh-CN')
}

export function reconcileHeartbeat(item: TaskItem, now: number) {
  if (item.heartbeat && item.light === 'yellow' && now - item.updatedAt > 90_000) {
    return { ...item, light: 'red' as const, reason: '状态中断，请检查原平台', stale: true }
  }
  return item
}

export function mapNativeStatus(platform: Platform, status: string): { light: Light; reason: string } {
  const value = status.toLowerCase()
  if (platform === 'workbuddy' && value === 'active') return { light: 'green', reason: '本轮完成 / 空闲' }
  if (['creating', 'planning', 'working', 'running', 'in_progress', 'busy'].includes(value)) {
    return { light: 'yellow', reason: '进行中' }
  }
  if (['pending', 'failed', 'blocked', 'waiting', 'awaiting_user', 'approval', 'question', 'error'].includes(value)) {
    return { light: 'red', reason: value === 'failed' || value === 'error' ? '执行失败，需检查' : '需要确认或处理' }
  }
  if (['completed', 'complete', 'idle', 'archived', 'cancelled', 'canceled'].includes(value)) {
    return { light: 'green', reason: '本轮完成 / 空闲' }
  }
  return { light: 'red', reason: `${platform} 未知状态：${status}` }
}
