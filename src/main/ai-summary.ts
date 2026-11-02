import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import type { ConversationTurn, ProgressEntry, TaskProgress } from '../shared/types.ts'
import type { AiService } from './ai-service.ts'
import type { ConnectorHub } from './connectors/index.ts'

const systemPrompt = `你是中文项目进展编辑。根据用户与 AI 助手的真实对话，或实际写入文件的内容，概括每一轮完成的功能。
只输出实际完成的工作或明确推进的事项，用简洁陈述句，不复述用户指令，不使用问答句式，不整段引用原文。
忽略技能说明、系统提醒、重复报错、504 网页和被中断的回复；不要把它们当成功能进展。
不能编造功能、日期或结果。每轮摘要不超过 42 个汉字。没有完成结果时写“本轮开始处理需求，尚无完成结果”。
按输入的 turnId 原样返回：{"summaries":[{"turnId":"...","summary":"..."}]}，不要输出其他文字。`

function fingerprint(turns: ConversationTurn[], provider: string, model: string) {
  return createHash('sha256').update(JSON.stringify({ turns, provider, model })).digest('hex')
}

function summaries(text: string) {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  const parsed = JSON.parse(cleaned) as { summaries?: { turnId?: string; summary?: string }[] }
  return new Map((parsed.summaries || []).flatMap(item => item.turnId && item.summary?.trim() ? [[item.turnId, item.summary.trim()] as const] : []))
}

export class AiSummaryService {
  private cache: Record<string, { fingerprint: string; progress: TaskProgress }> = {}

  constructor(private readonly ai: AiService, private readonly hub: ConnectorHub, private readonly filePath: string) {
    if (existsSync(filePath)) {
      try { this.cache = JSON.parse(readFileSync(filePath, 'utf8')) } catch { this.cache = {} }
    }
  }

  getCached(key: string) {
    const turns = this.hub.getConversation(key)
    const selected = this.ai.getSelected()
    const cached = this.cache[key]
    return cached?.fingerprint === fingerprint(turns, selected.provider, selected.model) ? cached.progress : undefined
  }

  async summarize(key: string): Promise<TaskProgress> {
    const task = this.hub.getTask(key)
    const turns = this.hub.getConversation(key)
    if (!turns.length) throw new Error('这个平台没有可发送给 AI 的会话或文件修改内容')
    const results = new Map<string, string>()
    for (let start = 0; start < turns.length; start += 12) {
      const batch = turns.slice(start, start + 12)
      const input = batch.map(turn => ({
        turnId: turn.id,
        user: turn.user.slice(0, 6000),
        assistant: turn.assistant.slice(0, 10000),
        files: turn.files
      }))
      const output = await this.ai.complete(systemPrompt, `会话标题：${task?.title || '未命名会话'}\n记录：\n${JSON.stringify(input)}`)
      for (const [id, summary] of summaries(output)) results.set(id, summary)
    }
    const selected = this.ai.getSelected()
    const progress: TaskProgress = {
      entries: turns.map(turn => ({
        id: turn.id, timestamp: turn.timestamp,
        summary: results.get(turn.id) || '本轮开始处理需求，尚无完成结果',
        files: turn.files
      })).sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0)) as ProgressEntry[],
      notice: task?.platform === 'kimi-work' ? 'Kimi Work 未提供每轮时间；摘要由 AI 根据实际写入文件的内容生成。' : undefined,
      ai: { ...selected, generatedAt: Date.now() }
    }
    this.cache[key] = { fingerprint: fingerprint(turns, selected.provider, selected.model), progress }
    mkdirSync(dirname(this.filePath), { recursive: true })
    const temp = join(dirname(this.filePath), `ai-summaries-${process.pid}.tmp`)
    writeFileSync(temp, JSON.stringify(this.cache), 'utf8')
    renameSync(temp, this.filePath)
    return progress
  }
}
