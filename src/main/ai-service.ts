import { readFileSync } from 'node:fs'
import Anthropic from '@anthropic-ai/sdk'
import type { AiModel, AiProvider, AiState, Settings } from '../shared/types.ts'
import { AiCredentialStore } from './ai-credentials.ts'

type AiServiceOptions = {
  credentialPath: string
  catalogPath: string
  catalogUrl: string
  getSettings: () => Settings
  updateSettings: (patch: Partial<Settings>) => Settings
  credentials?: AiCredentialStore
}

export class AiService {
  private readonly credentials: AiCredentialStore
  private providers: AiProvider[] = []
  private models = new Map<string, AiModel[]>()
  private catalogUpdatedAt = 0

  constructor(private readonly options: AiServiceOptions) {
    this.credentials = options.credentials || new AiCredentialStore(options.credentialPath)
  }

  private async providersList() {
    if (!this.providers.length) this.providers = JSON.parse(readFileSync(this.options.catalogPath, 'utf8')) as AiProvider[]
    if (Date.now() - this.catalogUpdatedAt > 86_400_000) {
      this.catalogUpdatedAt = Date.now()
      try {
        const response = await fetch(this.options.catalogUrl, { signal: AbortSignal.timeout(5000) })
        if (response.ok) {
          const remote = await response.json() as AiProvider[]
          if (Array.isArray(remote) && remote.every(item => item.id && item.name && item.kind)) this.providers = remote
        }
      } catch { /* Use the bundled provider catalog when the remote catalog is unavailable. */ }
    }
    return this.providers
  }

  private async provider(id?: string) {
    const providerId = id || this.options.getSettings().aiProvider
    const provider = (await this.providersList()).find(item => item.id === providerId)
    if (!provider) throw new Error('未知 AI 厂商，请重新选择')
    if (provider.id === 'custom') provider.baseUrl = this.options.getSettings().aiBaseUrl || ''
    if (!provider.baseUrl) throw new Error('请先填写自定义接口地址')
    new URL(provider.baseUrl)
    return provider
  }

  private static endpoint(baseUrl: string, path: string) {
    return `${baseUrl.replace(/\/+$/, '')}${path}`
  }

  private static async response(response: Response) {
    if (!response.ok) {
      const detail = (await response.text()).slice(0, 500)
      throw new Error(`AI 接口请求失败（HTTP ${response.status}）：${detail}`)
    }
    return response.json()
  }

  async getState(providerId?: string): Promise<AiState> {
    const settings = this.options.getSettings()
    const selectedProvider = providerId || settings.aiProvider
    const model = selectedProvider === settings.aiProvider ? settings.aiModel : ''
    return {
      provider: selectedProvider, model, baseUrl: settings.aiBaseUrl,
      hasKey: this.credentials.has(selectedProvider), keyHint: this.credentials.hint(selectedProvider), providers: await this.providersList(),
      models: this.models.get(selectedProvider) || (model ? [{ id: model, name: model }] : [])
    }
  }

  async connect(providerId: string, apiKey: string, baseUrl?: string) {
    this.options.updateSettings({ aiProvider: providerId, aiBaseUrl: baseUrl || undefined, aiModel: '' })
    this.credentials.set(providerId, apiKey)
    const provider = await this.provider(providerId)
    const models = await this.listModels(provider)
    this.models.set(providerId, models)
    const settings = this.options.getSettings()
    const selected = models.some(model => model.id === settings.aiModel) ? settings.aiModel : models[0]?.id || ''
    this.options.updateSettings({ aiModel: selected })
    return this.getState()
  }

  async selectModel(providerId: string, model: string, baseUrl?: string) {
    this.options.updateSettings({ aiProvider: providerId, aiModel: model, aiBaseUrl: baseUrl || undefined })
    return this.getState()
  }

  private async listModels(provider: AiProvider): Promise<AiModel[]> {
    const apiKey = this.credentials.get(provider.id)
    if (provider.kind === 'anthropic') {
      const client = new Anthropic({ apiKey })
      const page = await client.models.list({ limit: 100 })
      return page.data.map(model => ({ id: model.id, name: model.display_name || model.id }))
    }
    if (provider.kind === 'gemini') {
      const data = await AiService.response(await fetch(AiService.endpoint(provider.baseUrl, '/v1beta/models'), {
        headers: { 'x-goog-api-key': apiKey }, signal: AbortSignal.timeout(20_000)
      }))
      return (data.models || []).flatMap((model: { name?: string; displayName?: string; supportedGenerationMethods?: string[] }) => {
        if (!model.name || !(model.supportedGenerationMethods || []).includes('generateContent')) return []
        const id = model.name.replace(/^models\//, '')
        return [{ id, name: model.displayName || id }]
      })
    }
    const data = await AiService.response(await fetch(AiService.endpoint(provider.baseUrl, '/models'), {
      headers: { Authorization: `Bearer ${apiKey}` }, signal: AbortSignal.timeout(20_000)
    }))
    return (data.data || []).flatMap((model: { id?: string; name?: string }) => {
      if (!model.id || /embed|whisper|tts|audio|dall|moderation|rerank|transcribe/i.test(model.id)) return []
      return [{ id: model.id, name: model.name || model.id }]
    }).sort((a: AiModel, b: AiModel) => a.name.localeCompare(b.name))
  }

  async complete(system: string, prompt: string) {
    const provider = await this.provider()
    const model = this.options.getSettings().aiModel
    if (!model) throw new Error('请先读取并选择大模型')
    const apiKey = this.credentials.get(provider.id)
    if (provider.kind === 'anthropic') {
      const client = new Anthropic({ apiKey })
      const response = await client.messages.create({ model, max_tokens: 4000, system, messages: [{ role: 'user', content: prompt }] })
      return response.content.flatMap(block => block.type === 'text' ? [block.text] : []).join('\n')
    }
    if (provider.kind === 'gemini') {
      const data = await AiService.response(await fetch(AiService.endpoint(provider.baseUrl, `/v1beta/models/${encodeURIComponent(model)}:generateContent`), {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({ systemInstruction: { parts: [{ text: system }] }, contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { responseMimeType: 'application/json', maxOutputTokens: 4000 } }),
        signal: AbortSignal.timeout(120_000)
      }))
      return (data.candidates?.[0]?.content?.parts || []).flatMap((part: { text?: string }) => part.text ? [part.text] : []).join('\n')
    }
    const data = await AiService.response(await fetch(AiService.endpoint(provider.baseUrl, '/chat/completions'), {
      method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }] }),
      signal: AbortSignal.timeout(120_000)
    }))
    const content = data.choices?.[0]?.message?.content
    if (typeof content === 'string') return content
    if (Array.isArray(content)) return content.flatMap((part: { type?: string; text?: string }) => part.type === 'text' && part.text ? [part.text] : []).join('\n')
    return ''
  }

  isConfigured() {
    const settings = this.options.getSettings()
    return Boolean(settings.aiModel && this.credentials.has(settings.aiProvider))
  }

  getSelected() {
    const settings = this.options.getSettings()
    return { provider: settings.aiProvider, model: settings.aiModel }
  }
}
