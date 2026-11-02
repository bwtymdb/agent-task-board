import type { ConversationTurn, ProgressEntry, TaskProgress } from '../shared/types.ts'

type RecordValue = Record<string, unknown>
type PendingEntry = { id: string; timestamp: number; summary: string; result?: string; files: Set<string> }

function asRecord(value: unknown): RecordValue | undefined {
  return value && typeof value === 'object' ? value as RecordValue : undefined
}

function timestamp(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0
}

function contentText(content: unknown) {
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''
  return content.flatMap(item => {
    const part = asRecord(item)
    return part && ['text', 'input_text', 'output_text'].includes(String(part.type)) && typeof part.text === 'string' ? [part.text] : []
  }).join('\n')
}

export function summarizeProgress(text: string, limit = 76) {
  if (/^(?:Skill tool loaded instructions|<skill-loaded\b|The conversation so far has been compacted)/i.test(text.trim())) return ''
  const cleaned = text.replace(/<system-reminder\b[^>]*>[\s\S]*?<\/system-reminder>/gi, ' ')
    .replace(/```[\s\S]*?```/g, ' ').replace(/[#>*_`]/g, '').replace(/\s+/g, ' ').trim()
  const sentences = cleaned.split(/(?<=[。！？!?])\s*/).filter(Boolean)
  const sentence = sentences.find(item => /新增|增加|添加|修复|修改|支持|实现|做成|加入|去掉|删除|优化|完善|同步|推送|构建|做一个/.test(item)) || sentences[0] || ''
  const simplified = sentence.replace(/^(?:我希望你?(?:能)?|我想你?(?:要)?|我想请你|我想让你|请帮我|请你|请|帮我|你帮我)/, '').trim()
  return simplified.length > limit ? `${simplified.slice(0, limit).trim()}…` : simplified
}

function argumentFiles(value: unknown) {
  const args = typeof value === 'string' ? (() => { try { return JSON.parse(value) as unknown } catch { return undefined } })() : value
  const record = asRecord(args)
  if (!record) return []
  return ['path', 'filePath', 'file_path', 'notebook_path'].flatMap(key => typeof record[key] === 'string' ? [record[key] as string] : [])
}

function fileName(path: string) {
  return path.replaceAll('\\', '/').split('/').filter(Boolean).at(-1) || path
}

function finishEntries(entries: PendingEntry[]): TaskProgress {
  return {
    entries: entries.map(entry => {
      const files = [...new Set([...entry.files].map(fileName))]
      const summary = entry.summary || (files.length ? `已修改 ${files[0]}${files.length > 1 ? ` 等 ${files.length} 个文件` : ''}` : '本轮未记录完成结果')
      return { ...entry, summary, files }
    }).sort((a, b) => b.timestamp - a.timestamp)
  }
}

function appendRecord(entries: PendingEntry[], current: PendingEntry | undefined, record: RecordValue, kind: 'kimi-code' | 'workbuddy') {
  const event = asRecord(record.event)
  const message = asRecord(record.message)
  const time = timestamp(record.time || record.timestamp)
  if (record.type === 'context.append_message' || (kind === 'workbuddy' && record.type === 'message')) {
    const role = message?.role || record.role
    const content = contentText(message?.content || record.content)
    const summary = summarizeProgress(content)
    if (role === 'user' && summary) {
      return { id: String(message?.id || record.id || `${time}-${entries.length}`), timestamp: time, summary: '', files: new Set<string>() }
    }
    if (role === 'assistant' && current && summary) current.summary = /[?？]\s*$/.test(summary) ? '等待你确认后继续处理' : summary
  }
  const part = asRecord(event?.part)
  if (kind === 'kimi-code' && event?.type === 'content.part' && current && typeof part?.text === 'string') {
    const summary = summarizeProgress(part.text)
    if (summary) current.summary = /[?？]\s*$/.test(summary) ? '等待你确认后继续处理' : summary
  }
  const toolCall = (kind === 'kimi-code' && event?.type === 'tool.call') || (kind === 'workbuddy' && record.type === 'function_call')
  const toolName = String(event?.name || record.name || '')
  if (current && toolCall && /edit|write|apply.*patch|create.*file|file.*create/i.test(toolName)) {
    for (const file of argumentFiles(event?.args || record.arguments)) current.files.add(file)
  }
  return current
}

export function parseKimiCodeProgress(records: RecordValue[]): TaskProgress {
  const entries: PendingEntry[] = []
  let current: PendingEntry | undefined
  for (const record of records) {
    const next = appendRecord(entries, current, record, 'kimi-code')
    if (next !== current && current) entries.push(current)
    current = next
  }
  if (current) entries.push(current)
  return finishEntries(entries)
}

export function parseWorkBuddyProgress(records: RecordValue[]): TaskProgress {
  const entries: PendingEntry[] = []
  let current: PendingEntry | undefined
  for (const record of records) {
    const next = appendRecord(entries, current, record, 'workbuddy')
    if (next !== current && current) entries.push(current)
    current = next
  }
  if (current) entries.push(current)
  return finishEntries(entries)
}

export function parseKimiWorkProgress(root: RecordValue, nativeId: string): TaskProgress {
  const raw = root[`agent:main:main:conversation:${nativeId}`]
  if (typeof raw !== 'string') return { entries: [], notice: '这个平台没有记录该会话的文件修改。' }
  try {
    const journal = JSON.parse(raw) as { turns?: { turnId?: string; entries?: { path?: string; existedBefore?: boolean }[] }[] }
    const entries: ProgressEntry[] = (journal.turns || []).flatMap((turn, index) => {
      const changes = turn.entries || []
      const files = [...new Set(changes.flatMap(item => typeof item.path === 'string' ? [fileName(item.path)] : []))]
      if (!files.length) return []
      const added = changes.filter(item => !item.existedBefore).length
      const updated = changes.length - added
      const result = [added ? `新增 ${added} 个文件` : '', updated ? `更新 ${updated} 个文件` : ''].filter(Boolean).join('，')
      return [{ id: turn.turnId || String(index), timestamp: null, summary: `第 ${turn.turnId || index + 1} 轮文件修改`, result, files }]
    }).reverse()
    return { entries, notice: 'Kimi Work 未记录每轮修改的时间，因此这些记录无法按真实日期归档。' }
  } catch {
    return { entries: [], notice: 'Kimi Work 的文件修改记录暂时无法读取。' }
  }
}

export function parseConversation(records: RecordValue[], kind: 'kimi-code' | 'workbuddy'): ConversationTurn[] {
  const turns: ConversationTurn[] = []
  let current: ConversationTurn | undefined
  const push = () => { if (current) turns.push(current) }
  for (const record of records) {
    const event = asRecord(record.event)
    const message = asRecord(record.message)
    const time = timestamp(record.time || record.timestamp) || null
    if (record.type === 'context.append_message' || (kind === 'workbuddy' && record.type === 'message')) {
      const role = message?.role || record.role
      const content = contentText(message?.content || record.content)
      if (role === 'user' && summarizeProgress(content)) {
        push()
        current = {
          id: String(message?.id || record.id || `${time}-${turns.length}`), timestamp: time,
          user: content.replace(/<system-reminder\b[^>]*>[\s\S]*?<\/system-reminder>/gi, '').trim(),
          assistant: '', files: []
        }
      } else if (role === 'assistant' && current) {
        current.assistant = [current.assistant, content].filter(Boolean).join('\n')
      }
    }
    const part = asRecord(event?.part)
    if (kind === 'kimi-code' && event?.type === 'content.part' && current && typeof part?.text === 'string') {
      current.assistant = [current.assistant, part.text].filter(Boolean).join('\n')
    }
    const toolCall = (kind === 'kimi-code' && event?.type === 'tool.call') || (kind === 'workbuddy' && record.type === 'function_call')
    const toolName = String(event?.name || record.name || '')
    if (current && toolCall && /edit|write|apply.*patch|create.*file|file.*create/i.test(toolName)) {
      for (const file of argumentFiles(event?.args || record.arguments)) current.files.push(fileName(file))
    }
  }
  push()
  return turns.map(turn => ({ ...turn, files: [...new Set(turn.files)] }))
}

export function parseKimiWorkConversation(root: RecordValue, nativeId: string): ConversationTurn[] {
  const raw = root[`agent:main:main:conversation:${nativeId}`]
  if (typeof raw !== 'string') return []
  try {
    const journal = JSON.parse(raw) as { turns?: { turnId?: string; entries?: { path?: string; after?: string }[] }[] }
    return (journal.turns || []).flatMap((turn, index) => {
      const changes = turn.entries || []
      if (!changes.length) return []
      return [{
        id: turn.turnId || String(index), timestamp: null, user: '',
        assistant: changes.map(item => `文件：${item.path || '未命名'}\n${item.after || ''}`).join('\n\n'),
        files: [...new Set(changes.flatMap(item => typeof item.path === 'string' ? [fileName(item.path)] : []))]
      }]
    }).reverse()
  } catch { return [] }
}
