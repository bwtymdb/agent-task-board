import { shell } from 'electron'
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import type { TaskItem } from '../shared/types.ts'

function firstExisting(candidates: string[]) {
  return candidates.find(candidate => candidate && existsSync(candidate))
}

export async function openTask(task: TaskItem): Promise<{ ok: boolean; message: string }> {
  if (task.platform === 'manual') {
    if (!task.url || !/^https?:\/\//i.test(task.url)) return { ok: false, message: '手动任务链接无效。' }
    await shell.openExternal(task.url)
    return { ok: true, message: '已在浏览器中打开。' }
  }
  if (task.platform === 'kimi-code') {
    if (!/^session_[a-zA-Z0-9-]+$/.test(task.nativeId)) return { ok: false, message: 'Kimi Code 会话 ID 无效。' }
    const executable = join(process.env.USERPROFILE || '', '.kimi-code', 'bin', 'kimi.exe')
    if (!existsSync(executable)) return { ok: false, message: `未找到 kimi.exe。可手动运行：kimi --session ${task.nativeId}` }
    try {
      const child = spawn('cmd.exe', ['/c', 'start', '', 'cmd.exe', '/k', `"${executable}" --session ${task.nativeId}`], {
        cwd: task.cwd || undefined, detached: true, stdio: 'ignore', windowsHide: true
      })
      child.unref()
      return { ok: true, message: '已在新终端中恢复 Kimi Code 会话。' }
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : String(error) }
    }
  }
  const candidates = task.platform === 'kimi-work'
    ? [join(process.env.LOCALAPPDATA || '', 'Programs', 'Kimi', 'Kimi.exe')]
    : [
        join(process.env.LOCALAPPDATA || '', 'Programs', 'WorkBuddy', 'WorkBuddy.exe'),
        join(process.env.LOCALAPPDATA || '', 'WorkBuddy', 'WorkBuddy.exe')
      ]
  const executable = firstExisting(candidates)
  if (!executable && task.platform === 'workbuddy') {
    spawn('explorer.exe', ['shell:AppsFolder\\WorkBuddy.WorkBuddy'], { detached: true, stdio: 'ignore' }).unref()
    return { ok: true, message: '已通过 Windows 应用入口打开 WorkBuddy。' }
  }
  if (!executable) return { ok: false, message: `未找到 ${task.platform === 'kimi-work' ? 'Kimi Work' : 'WorkBuddy'} 安装路径。` }
  const error = await shell.openPath(executable)
  return error ? { ok: false, message: error } : { ok: true, message: `已打开 ${task.platform === 'kimi-work' ? 'Kimi Work' : 'WorkBuddy'}。` }
}
