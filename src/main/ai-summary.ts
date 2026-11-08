import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import type { ConversationTurn, ProgressDay, TaskProgress } from '../shared/types.ts'
import type { AiService } from './ai-service.ts'
import type { ConnectorHub } from './connectors/index.ts'

const systemPrompt = `你是中文项目复盘编辑。输入中每轮只包含用户要求和 AI 的最后一个回复。把同一任务、同一天内的所有要求与最终结果合并成一份每日工作总结，不按消息或工具调用逐条记录。
重点回答：当天围绕用户目标完成了哪些功能、添加或修改了什么、实际做到了什么程度、哪些要求尚未完成及原因、下一步有什么必要建议。
合并相同目标和重复尝试，忽略技能说明、系统提醒、工具操作流水、重复报错、504 网页和被中断内容。不要把“开始尝试”写成“已经完成”，不要编造结果。
overview 用一两句陈述句概括当天工作和完成程度；completed 最多 4 条，pending 最多 3 条，suggestions 最多 2 条，每条简短清楚，不使用问答句，不引用用户原话。
status 只能是 completed（当日目标已有完成证据）、in-progress（仍有工作待继续）、blocked（存在阻碍需处理）。
只返回 JSON：{"overview":"...","completed":["..."],"pending":["..."],"suggestions":["..."],"status":"completed"}。`

type CachedDay = { fingerprint: string; day: ProgressDay; generatedAt: number }
type TaskCache = { days: Record<string, CachedDay> }

function fingerprint(turns: ConversationTurn[], provider: string, model: string) {
  return createHash('sha256').update(JSON.stringify({ version: 'daily-v2', turns, provider, model })).digest('hex')
}

function dayKey(timestamp: number | null) {
  if (timestamp === null) return null
  const date = new Date(timestamp)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function parseDay(text: string, date: string | null, files: string[]): ProgressDay {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  const value = JSON.parse(cleaned) as Partial<ProgressDay>
  const list = (input: unknown, limit: number) => Array.isArray(input) ? input.flatMap(item => typeof item === 'string' && item.trim() ? [item.trim()] : []).slice(0, limit) : []
  const status = ['completed', 'in-progress', 'blocked'].includes(value.status || '') ? value.status as ProgressDay['status'] : 'in-progress'
  return {
    date, status, files,
    overview: typeof value.overview === 'string' && value.overview.trim() ? value.overview.trim() : '当日工作已整理，具体完成程度需结合后续记录确认。',
    completed: list(value.completed, 4), pending: list(value.pending, 3), suggestions: list(value.suggestions, 2)
  }
}

export class AiSummaryService {
  private cache: Record<string, TaskCache> = {}
  private pending = new Map<string, Promise<TaskProgress>>()
  private timer?: NodeJS.Timeout
  private lastScheduledDate = ''

  constructor(private readonly ai: AiService, private readonly hub: ConnectorHub, private readonly filePath: string) {
    if (existsSync(filePath)) {
      try {
        const saved = JSON.parse(readFileSync(filePath, 'utf8')) as Record<string, TaskCache>
        this.cache = Object.fromEntries(Object.entries(saved).filter(([, value]) => value.days && typeof value.days === 'object'))
      } catch { this.cache = {} }
    }
  }

  private historicalGroups(turns: ConversationTurn[]) {
    const today = dayKey(Date.now())
    const groups = new Map<string | null, ConversationTurn[]>()
    for (const turn of turns) {
      const date = dayKey(turn.timestamp)
      if (date === today) continue
      groups.set(date, [...(groups.get(date) || []), turn])
    }
    return [...groups].sort(([a], [b]) => (b || '').localeCompare(a || ''))
  }

  private save() {
    mkdirSync(dirname(this.filePath), { recursive: true })
    const temp = join(dirname(this.filePath), `ai-summaries-${process.pid}.tmp`)
    writeFileSync(temp, JSON.stringify(this.cache), 'utf8')
    renameSync(temp, this.filePath)
  }

  private localProgress(key: string): TaskProgress {
    const local = this.hub.getProgress(key)
    const today = dayKey(Date.now())
    return {
      ...local,
      entries: local.entries.filter(entry => dayKey(entry.timestamp) !== today),
      notice: [local.notice, '只总结往日内容；配置 AI 后，打开进展或每日上午 8 点自动整理。'].filter(Boolean).join(' ')
    }
  }

  async getProgress(key: string): Promise<TaskProgress> {
    const existing = this.pending.get(key)
    if (existing) return existing
    const task = this.hub.getTask(key)
    if (!this.ai.isConfigured()) return this.localProgress(key)
    const promise = this.generateChangedDays(key).finally(() => this.pending.delete(key))
    this.pending.set(key, promise)
    return promise
  }

  async summarize(key: string) { return this.getProgress(key) }

  private async generateChangedDays(key: string): Promise<TaskProgress> {
    const task = this.hub.getTask(key)
    const turns = this.hub.getConversation(key)
    const groups = this.historicalGroups(turns)
    const selected = this.ai.getSelected()
    if (!groups.length) return { entries: [], days: [], notice: '只总结往日内容，今天的工作将在明天或下次启动后整理。' }
    const taskCache = this.cache[key] || { days: {} }
    this.cache[key] = taskCache
    const days: ProgressDay[] = []
    let changed = false
    let generatedAt = 0
    for (const [date, dailyTurns] of groups) {
      const cacheKey = date || 'unrecorded'
      const hash = fingerprint(dailyTurns, selected.provider, selected.model)
      const cached = taskCache.days[cacheKey]
      if (cached?.fingerprint === hash) {
        days.push(cached.day)
        generatedAt = Math.max(generatedAt, cached.generatedAt)
        continue
      }
      const budget = Math.max(600, Math.floor(60_000 / Math.max(1, dailyTurns.length * 2)))
      const input = dailyTurns.map(turn => ({
        user: turn.user.slice(0, budget), finalResponse: turn.assistant.slice(0, budget * 2), files: turn.files
      }))
      const files = [...new Set(dailyTurns.flatMap(turn => turn.files))]
      const output = await this.ai.complete(systemPrompt, `会话标题：${task?.title || '未命名会话'}\n总结日期：${date || '平台未记录日期'}\n当日用户要求与各轮最终回复（超长消息会限长截取，不得编造缺失内容）：\n${JSON.stringify(input)}`)
      const day = parseDay(output, date, files)
      generatedAt = Date.now()
      taskCache.days[cacheKey] = { fingerprint: hash, day, generatedAt }
      days.push(day)
      changed = true
    }
    if (changed) this.save()
    return {
      entries: [], days,
      notice: task?.platform === 'kimi-work' ? 'Kimi Work 未提供每轮时间；AI 根据实际写入文件的内容整理工作总结。' : undefined,
      ai: { ...selected, generatedAt: generatedAt || Date.now() }
    }
  }

  async refreshAll() {
    if (!this.ai.isConfigured()) return { completed: 0, failed: 0 }
    let completed = 0
    let failed = 0
    for (const task of this.hub.getSnapshot().tasks) {
      try { await this.getProgress(task.key); completed++ }
      catch { failed++ }
    }
    return { completed, failed }
  }

  start() {
    void this.refreshAll()
    const now = new Date()
    if (now.getHours() >= 8) this.lastScheduledDate = dayKey(now.getTime()) || ''
    this.timer = setInterval(() => {
      const now = new Date()
      const today = dayKey(now.getTime()) || ''
      if (now.getHours() >= 8 && this.lastScheduledDate !== today) {
        this.lastScheduledDate = today
        void this.refreshAll()
      }
    }, 60_000)
  }

  stop() { clearInterval(this.timer) }
}
