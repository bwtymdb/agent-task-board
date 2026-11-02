import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { createRequire } from 'node:module'

const { safeStorage } = createRequire(import.meta.url)('electron') as typeof import('electron')

type Cipher = { encrypt: (value: string) => Buffer; decrypt: (value: Buffer) => string }
const systemCipher: Cipher = {
  encrypt: value => {
    if (!safeStorage.isEncryptionAvailable()) throw new Error('Windows 当前无法加密保存 API Key')
    return safeStorage.encryptString(value)
  },
  decrypt: value => safeStorage.decryptString(value)
}

export class AiCredentialStore {
  private values: Record<string, string> = {}

  constructor(private readonly filePath: string, private readonly cipher: Cipher = systemCipher) {
    if (!existsSync(filePath)) return
    try { this.values = JSON.parse(readFileSync(filePath, 'utf8')).providers || {} } catch { this.values = {} }
  }

  has(provider: string) { return Boolean(this.values[provider]) }

  hint(provider: string) {
    if (!this.has(provider)) return undefined
    const key = this.get(provider)
    return `••••••••${key.slice(-4)}`
  }

  get(provider: string) {
    const encrypted = this.values[provider]
    if (!encrypted) throw new Error('请先填写并保存这个厂商的 API Key')
    return this.cipher.decrypt(Buffer.from(encrypted, 'base64'))
  }

  set(provider: string, apiKey: string) {
    if (!apiKey.trim()) return
    this.values[provider] = this.cipher.encrypt(apiKey.trim()).toString('base64')
    mkdirSync(dirname(this.filePath), { recursive: true })
    const temp = join(dirname(this.filePath), `ai-credentials-${process.pid}.tmp`)
    writeFileSync(temp, JSON.stringify({ version: 1, providers: this.values }), { mode: 0o600 })
    renameSync(temp, this.filePath)
  }
}
