export function isOwnBoardCommand(command?: string) {
  if (!command) return false
  const value = command.toLowerCase()
  const executable = process.execPath.toLowerCase()
  const workingDirectory = process.cwd().toLowerCase()
  return value.includes('ai任务看板.exe') || value.includes(executable)
    || (value.startsWith('npx electron ') && workingDirectory.includes('agent-task-board'))
}
