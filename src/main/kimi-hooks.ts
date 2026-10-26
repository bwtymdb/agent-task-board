import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const events = ['TurnStarted', 'PermissionRequest', 'PermissionResult', 'Stop', 'StopFailure', 'Interrupt', 'TaskStarted', 'SessionHeartbeat', 'SessionEnd']

function tomlString(value: string) {
  return JSON.stringify(value.replaceAll('\\', '/'))
}

export function installKimiCodeHooks(home: string, reporterPath: string, connectionPath: string) {
  const configPath = join(home, 'config.toml')
  const command = `node ${JSON.stringify(reporterPath)} ${JSON.stringify(connectionPath)}`
  const serializedCommand = tomlString(command)
  let config = existsSync(configPath) ? readFileSync(configPath, 'utf8') : ''
  if (config.includes(serializedCommand)) return { ok: true, message: 'Kimi Code Hooks 已配置，无需重复安装。' }
  if (existsSync(configPath)) copyFileSync(configPath, `${configPath}.agent-board-backup-${Date.now()}`)
  const blocks = events.map(event => `\n[[hooks]]\nevent = "${event}"\ncommand = ${serializedCommand}\ntimeout = 10\n`).join('')
  const managedBlock = `# >>> AI 任务看板 >>>\n# 以下 Hook 仅上报状态，不拦截操作。\n${blocks}# <<< AI 任务看板 <<<\n`
  const managedPattern = /# >>> AI 任务看板 >>>[\s\S]*?# <<< AI 任务看板 <<<\n?/
  config = managedPattern.test(config)
    ? config.replace(managedPattern, managedBlock)
    : `${config.trimEnd()}\n${managedBlock}`
  writeFileSync(configPath, config, 'utf8')
  return { ok: true, message: 'Kimi Code Hooks 已添加。新会话自动生效，已运行的会话可能需要重启。' }
}
