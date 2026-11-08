import { existsSync, readdirSync, readFileSync, statSync, watch, type FSWatcher } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { zstdDecompressSync } from 'node:zlib'
import type { ConnectorHealth, ConversationTurn, TaskItem, TaskProgress } from '../../shared/types.ts'
import { summarizeProgress } from '../progress.ts'

type HarnessRecord = { type?: string; time?: number; data?: unknown }
type ParsedHarness = { task: TaskItem; turns: ConversationTurn[] }

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? value as Record<string, unknown> : {}
}

function textContent(value: unknown): string {
  if (typeof value === 'string') return value
  if (!Array.isArray(value)) return ''
  return value.flatMap(item => {
    const part = record(item)
    return typeof part.text === 'string' && (!part.type || part.type === 'text' || part.type === 'input_text' || part.type === 'output_text') ? [part.text] : []
  }).join('\n')
}

function zstdFrameEnd(buffer: Buffer, start: number) {
  let cursor = start + 4
  if (cursor >= buffer.length) throw new Error('Zstandard 帧头不完整')
  const descriptor = buffer[cursor++]
  const singleSegment = Boolean(descriptor & 0x20)
  const checksum = Boolean(descriptor & 0x04)
  const contentSizeFlag = descriptor >> 6
  const dictionarySize = [0, 1, 2, 4][descriptor & 0x03]
  cursor += dictionarySize + (singleSegment ? 0 : 1) + (contentSizeFlag === 0 ? (singleSegment ? 1 : 0) : 1 << contentSizeFlag)
  while (cursor + 3 <= buffer.length) {
    const header = buffer.readUIntLE(cursor, 3)
    const blockSize = ((header >>> 1) & 0x03) === 1 ? 1 : header >>> 3
    if (((header >>> 1) & 0x03) === 3) throw new Error('Zstandard 包含保留块类型')
    cursor += 3 + blockSize
    if (cursor > buffer.length) throw new Error('Zstandard 帧内容不完整')
    if (header & 1) break
  }
  cursor += checksum ? 4 : 0
  if (cursor > buffer.length) throw new Error('Zstandard 帧校验不完整')
  return cursor
}

function decodeZstdFrames(buffer: Buffer) {
  const frames: Buffer[] = []
  let offset = 0
  while (offset < buffer.length) {
    if (offset + 4 > buffer.length) throw new Error('Zstandard 帧头不完整')
    const signature = buffer.readUInt32LE(offset)
    if (signature >= 0x184d2a50 && signature <= 0x184d2a5f) {
      if (offset + 8 > buffer.length) throw new Error('Zstandard 可跳过帧头不完整')
      offset += 8 + buffer.readUInt32LE(offset + 4)
      continue
    }
    if (signature !== 0xfd2fb528) throw new Error('不是有效的 Zstandard 会话日志')
    const end = zstdFrameEnd(buffer, offset)
    frames.push(zstdDecompressSync(buffer.subarray(offset, end)))
    offset = end
  }
  return Buffer.concat(frames).toString('utf8')
}

export function readHarnessLog(filePath: string): HarnessRecord[] {
  const buffer = readFileSync(filePath)
  const text = filePath.toLowerCase().endsWith('.zstd') ? decodeZstdFrames(buffer) : buffer.toString('utf8')
  const records = text.split(/\r?\n/).flatMap(line => {
    try { return [JSON.parse(line) as HarnessRecord] } catch { return [] }
  })
  if (!records.length) throw new Error('会话日志没有可读取的有效事件')
  return records
}

export function parseHarnessRecords(records: HarnessRecord[], filePath: string): ParsedHarness {
  const id = basename(dirname(filePath))
  const task: TaskItem = {
    key: `deepseek-harness:${id}`, nativeId: id, platform: 'deepseek-harness',
    title: `DeepSeek Harness 会话 · ${id.slice(0, 8)}`, light: 'green', reason: '历史 / 空闲',
    updatedAt: statSync(filePath).mtimeMs, archived: false, unread: false, stale: false
  }
  const turns: ConversationTurn[] = []
  let activeTurn: number | undefined
  for (const envelope of records) {
    const data = record(envelope.data)
    const time = typeof envelope.time === 'number' ? envelope.time : task.updatedAt
    task.updatedAt = Math.max(task.updatedAt, time)
    if (envelope.type === 'session') {
      if (typeof data.id === 'string' && data.id) {
        task.nativeId = data.id
        task.key = `deepseek-harness:${data.id}`
      }
      if (typeof data.createdAt === 'number') task.updatedAt = Math.max(task.updatedAt, data.createdAt)
      if (typeof data.cwd === 'string') task.cwd = data.cwd
    } else if (envelope.type === 'session/title' && typeof data.title === 'string' && data.title.trim()) {
      task.title = data.title.trim()
    } else if (envelope.type === 'working-directory/change') {
      const cwd = data.cwd || data.path
      if (typeof cwd === 'string') task.cwd = cwd
    } else if (envelope.type === 'turn/start') {
      activeTurn = typeof data.turn === 'number' ? data.turn : activeTurn
      task.light = 'yellow'
      task.reason = '进行中'
    } else if (envelope.type === 'turn/end') {
      const kind = record(data.reason).kind
      if (kind === 'completed') {
        task.light = 'green'; task.reason = '本轮完成 / 空闲'
      } else if (kind === 'aborted' || kind === 'interrupted' || kind === 'forked') {
        task.light = 'green'; task.reason = '本轮停止 / 空闲'
      } else {
        task.light = 'red'; task.reason = kind === 'blocked' ? '需要确认或处理' : '执行失败或内容被截断，需检查'
      }
      activeTurn = undefined
    } else if (envelope.type === 'approval/asked') {
      task.light = 'red'; task.reason = '需要确认或处理'
    } else if (envelope.type === 'approval/decided' && activeTurn !== undefined) {
      task.light = 'yellow'; task.reason = '进行中'
    } else if (envelope.type === 'user/message') {
      if (typeof data.source === 'string' && /agent|inject|goal|cron|skill|system|autom/i.test(data.source)) continue
      const user = textContent(data.content)
      if (!user.trim()) continue
      const turn = typeof data.turn === 'number' ? data.turn : activeTurn
      turns.push({ id: `turn-${turn ?? turns.length}-${time}`, timestamp: time, user, assistant: '', files: [] })
    } else if (envelope.type === 'assistant/message') {
      const assistant = textContent(record(data.message).content)
      if (!assistant.trim()) continue
      const turn = typeof data.turn === 'number' ? data.turn : activeTurn
      const target = [...turns].reverse().find(item => item.id.startsWith(`turn-${turn ?? activeTurn ?? ''}-`)) || turns.at(-1)
      if (target) target.assistant = assistant
    } else if (envelope.type === 'tool/call' && /edit|write|apply.*patch|create.*file|file.*create/i.test(String(data.name || ''))) {
      let args: Record<string, unknown> = {}
      try { args = record(JSON.parse(String(data.arguments || '{}'))) } catch { /* Invalid tool arguments do not affect conversation parsing. */ }
      const target = turns.at(-1)
      if (target) for (const key of ['path', 'filePath', 'file_path']) {
        const value = args[key]
        if (typeof value === 'string') target.files.push(basename(value.replaceAll('\\', '/')))
      }
    }
  }
  for (const turn of turns) turn.files = [...new Set(turn.files)]
  return { task, turns }
}

export class DeepSeekHarnessConnector {
  readonly platform = 'deepseek-harness' as const
  private readonly root: string
  private tasks = new Map<string, TaskItem>()
  private conversations = new Map<string, ConversationTurn[]>()
  private paths = new Map<string, string>()
  private health: ConnectorHealth = { platform: 'deepseek-harness', connected: false, detail: '尚未连接', stale: false }
  private timer?: NodeJS.Timeout
  private watcher?: FSWatcher
  private refreshTimer?: NodeJS.Timeout

  constructor(home: string, private readonly notify: () => void) {
    this.root = join(home, 'sessions')
  }

  private files() {
    if (!existsSync(this.root)) return []
    const candidates = (readdirSync(this.root, { recursive: true }) as string[])
      .filter(name => /(^|[\\/])session(?:\.v\d+)?\.jsonl(?:\.zstd)?$/i.test(name))
      .map(name => join(this.root, name))
    const latest = new Map<string, { path: string; modified: number }>()
    for (const path of candidates) {
      const directory = dirname(path)
      const modified = statSync(path).mtimeMs
      const current = latest.get(directory)
      if (!current || modified > current.modified) latest.set(directory, { path, modified })
    }
    return [...latest.values()].map(item => item.path)
  }

  async start() {
    await this.refresh()
    this.timer = setInterval(() => void this.refresh(), 3000)
    if (existsSync(this.root)) this.watcher = watch(this.root, { recursive: true }, () => {
      clearTimeout(this.refreshTimer)
      this.refreshTimer = setTimeout(() => void this.refresh(), 150)
    })
  }

  async refresh() {
    try {
      const files = this.files()
      const next = new Map<string, TaskItem>()
      const conversations = new Map<string, ConversationTurn[]>()
      let failures = 0
      for (const file of files) {
        try {
          const parsed = parseHarnessRecords(readHarnessLog(file), file)
          next.set(parsed.task.nativeId, parsed.task)
          conversations.set(parsed.task.nativeId, parsed.turns)
          this.paths.set(parsed.task.nativeId, file)
        } catch {
          failures++
          const previous = this.tasks.get(basename(dirname(file)))
          if (previous) next.set(previous.nativeId, { ...previous, stale: true })
          const previousConversation = this.conversations.get(basename(dirname(file)))
          if (previousConversation) conversations.set(basename(dirname(file)), previousConversation)
        }
      }
      this.tasks = next
      this.conversations = conversations
      const found = existsSync(this.root)
      this.health = {
        platform: 'deepseek-harness', connected: found, stale: failures > 0,
        detail: !found ? '尚未发现 Harness 数据；安装并产生会话后自动接入'
          : `本地会话日志 · ${next.size} 个会话${failures ? ` · ${failures} 个文件待核对` : ''}`
      }
    } catch (error) {
      for (const [key, task] of this.tasks) this.tasks.set(key, { ...task, stale: true })
      this.health = { platform: 'deepseek-harness', connected: false, detail: `读取失败：${error instanceof Error ? error.message : String(error)}`, stale: true }
    }
    this.notify()
  }

  getProgress(id: string): TaskProgress {
    const turns = this.conversations.get(id) || []
    return {
      entries: turns.map(turn => ({
        id: turn.id, timestamp: turn.timestamp,
        summary: summarizeProgress(turn.assistant) || (turn.files.length ? `已修改 ${turn.files[0]} 等文件` : '本轮未记录完成结果'),
        files: turn.files
      })).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
    }
  }

  getConversation(id: string) { return this.conversations.get(id) || [] }
  getTasks() { return [...this.tasks.values()] }
  getHealth() { return this.health }
  async stop() { clearInterval(this.timer); clearTimeout(this.refreshTimer); this.watcher?.close() }
}
