import { app, shell } from 'electron'
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import type { TaskItem } from '../shared/types.ts'

function firstExisting(candidates: string[]) {
  return candidates.find(candidate => candidate && existsSync(candidate))
}

async function openKimiCodeDesktop(task: TaskItem, executable: string) {
  const child = spawn(executable, task.cwd ? ['app', task.cwd] : ['app'], {
    cwd: task.cwd || undefined, detached: true, stdio: 'ignore', windowsHide: true
  })
  child.unref()
  await new Promise(resolve => setTimeout(resolve, 800))
  const script = app.isPackaged
    ? join(process.resourcesPath, 'open-kimi-code-session.ps1')
    : join(process.cwd(), 'resources', 'open-kimi-code-session.ps1')
  const result = await new Promise<{ code: number | null; error: string }>((resolve, reject) => {
    const ps = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', script, '-Title', task.title], {
      windowsHide: true
    })
    let error = ''
    ps.stderr.on('data', chunk => { error += chunk.toString() })
    ps.on('error', reject)
    ps.on('close', code => resolve({ code, error: error.trim() })
    )
    setTimeout(() => {
      ps.kill()
      resolve({ code: 1, error: '桌面端会话定位超时，请重试。' })
    }, 12_000).unref()
  })
  if (result.code !== 0) return { ok: false, message: result.error || '未能在 Kimi Code 桌面端定位原对话。' }
  return { ok: true, message: '已在 Kimi Code 桌面端打开原对话。' }
}

export async function openTask(task: TaskItem, kimiCodeTarget: 'desktop' | 'cli' = 'desktop'): Promise<{ ok: boolean; message: string }> {
  if (task.platform === 'kimi-code') {
    if (!/^session_[a-zA-Z0-9-]+$/.test(task.nativeId)) return { ok: false, message: 'Kimi Code 会话 ID 无效。' }
    const executable = join(process.env.USERPROFILE || '', '.kimi-code', 'bin', 'kimi.exe')
    if (!existsSync(executable)) return { ok: false, message: `未找到 kimi.exe。可手动运行：kimi --session ${task.nativeId}` }
    try {
      if (kimiCodeTarget === 'desktop') return await openKimiCodeDesktop(task, executable)
      const child = spawn('cmd.exe', ['/c', 'start', '', 'cmd.exe', '/k', `"${executable}" --session ${task.nativeId}`], {
        cwd: task.cwd || undefined, detached: true, stdio: 'ignore', windowsHide: true
      })
      child.unref()
      return { ok: true, message: '已在新 CMD 终端中恢复 Kimi Code 会话。' }
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : String(error) }
    }
  }
  if (task.platform === 'workbuddy') {
    await shell.openExternal(`workbuddy://chat/${encodeURIComponent(task.nativeId)}`)
    return { ok: true, message: '已在 WorkBuddy 中打开原对话。' }
  }
  const executable = firstExisting([join(process.env.LOCALAPPDATA || '', 'Programs', 'Kimi', 'Kimi.exe')])
  if (!executable) return { ok: false, message: '未找到 Kimi Work 安装路径。' }
  const error = await shell.openPath(executable)
  return error ? { ok: false, message: error } : { ok: true, message: '已打开 Kimi Work。' }
}
