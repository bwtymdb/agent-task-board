import { useEffect, useState } from 'react'
import type { AiState } from '../../../shared/types.ts'

export function AiSettings() {
  const [state, setState] = useState<AiState>()
  const [apiKey, setApiKey] = useState('')
  const [baseUrl, setBaseUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [editing, setEditing] = useState(true)

  useEffect(() => {
    window.board.getAiState().then(next => { setState(next); setBaseUrl(next.baseUrl || ''); setEditing(!next.hasKey || !next.model) })
      .catch(error => setMessage(error instanceof Error ? error.message : String(error)))
  }, [])

  const provider = state?.providers.find(item => item.id === state.provider)
  const endpoint = state?.provider === 'custom' ? baseUrl : provider?.baseUrl

  async function connect() {
    if (!state) return
    setBusy(true); setMessage('')
    try {
      const next = await window.board.connectAi(state.provider, apiKey, state.provider === 'custom' ? baseUrl : undefined)
      setState(next); setApiKey('')
      const modelName = next.models.find(model => model.id === next.model)?.name || next.model || '无可用模型'
      setMessage(`已读取 ${next.models.length} 个模型，当前使用 ${modelName}。`)
    } catch (error) { setMessage(error instanceof Error ? error.message : String(error)) }
    finally { setBusy(false) }
  }

  async function selectModel(modelId: string) {
    if (!state) return
    const next = await window.board.selectAiModel(state.provider, modelId, state.provider === 'custom' ? baseUrl : undefined)
    setState(next)
    setMessage(`已切换为 ${next.models.find(model => model.id === modelId)?.name || modelId}，配置已保存。`)
  }

  if (!state) return <section className="setting-block"><h3 className="section-title">AI 进展总结</h3><p className="setting-note">正在读取厂商配置…</p></section>
  const ready = Boolean(state.hasKey && state.model && endpoint)
  return <section className="setting-block ai-settings">
    <h3 className="section-title">AI 进展总结</h3>
    <div className={`ai-connection-status ${ready ? 'ready' : ''}`}>
      <i />
      <div><div className="ai-status-title"><strong>{ready ? '接入已配置' : '待完成配置'}</strong><button onClick={() => setEditing(value => !value)}>{editing ? '收起编辑' : '编辑配置'}</button></div><span>{provider?.name}</span><code>{endpoint || '尚未填写接口地址'}</code><span>API Key：{state.keyHint || '尚未保存'}</span><span>当前模型：{state.model || '尚未选择'}</span></div>
    </div>
    {editing && <>
      <label>厂商 / 套餐
        <select value={state.provider} onChange={event => void window.board.getAiState(event.target.value).then(next => { setState(next); setBaseUrl(next.baseUrl || ''); setMessage('') })}>
          {state.providers.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
      </label>
      {state.provider === 'custom' && <label>接口地址<input type="url" value={baseUrl} placeholder="https://example.com/v1" onChange={event => setBaseUrl(event.target.value)} /></label>}
      <label>API Key<input type="password" value={apiKey} autoComplete="off" spellCheck={false} placeholder={state.hasKey ? '已加密保存，输入新 Key 可替换' : '输入所选厂商或套餐的 API Key'} onChange={event => setApiKey(event.target.value)} /></label>
      <button className="wide-button" disabled={busy || (!apiKey && !state.hasKey)} onClick={() => void connect()}>{busy ? '正在读取模型…' : '保存配置并读取模型'}</button>
      <label>大模型
        <select value={state.model} disabled={!state.models.length} onChange={event => void selectModel(event.target.value)}>
          {!state.models.length && <option value="">先读取模型</option>}
          {state.models.map(model => <option key={model.id} value={model.id}>{model.name}</option>)}
        </select>
      </label>
      {ready && <button className="text-button ai-finish-edit" onClick={() => setEditing(false)}>完成配置</button>}
    </>}
    <p className="setting-note">已保存配置可随时点击“编辑配置”修改，模型切换会立即保存。会员套餐与开放平台接口已分开。Key 使用 Windows 加密保存；只有点击“AI 总结”时才发送该会话内容。</p>
    {message && <p className="inline-message" aria-live="polite">{message}</p>}
  </section>
}
