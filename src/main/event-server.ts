import { createServer, type Server } from 'node:http'
import { randomBytes } from 'node:crypto'
import { writeFileSync } from 'node:fs'
import type { KimiCodeConnector } from './connectors/kimi-code.ts'

export class HookEventServer {
  readonly token = randomBytes(24).toString('hex')
  readonly port = 47823
  private server?: Server

  constructor(private readonly connector: KimiCodeConnector, private readonly connectionPath: string) {}

  async start() {
    writeFileSync(this.connectionPath, JSON.stringify({ port: this.port, token: this.token }), { mode: 0o600 })
    this.server = createServer((request, response) => {
      if (request.method !== 'POST' || request.url !== '/hook' || request.headers.authorization !== `Bearer ${this.token}`) {
        response.writeHead(401).end('Unauthorized')
        return
      }
      let body = ''
      request.setEncoding('utf8')
      request.on('data', chunk => {
        body += chunk
        if (body.length > 65_536) request.destroy()
      })
      request.on('end', () => {
        try {
          this.connector.ingest(JSON.parse(body))
          response.writeHead(204).end()
        } catch {
          response.writeHead(400).end('Invalid event')
        }
      })
      request.on('error', () => {
        if (!response.headersSent) response.writeHead(413)
        response.end()
      })
    })
    await new Promise<void>((resolve, reject) => {
      this.server!.once('error', reject)
      this.server!.listen(this.port, '127.0.0.1', () => resolve())
    })
  }

  async stop() {
    if (!this.server) return
    await new Promise<void>(resolve => this.server!.close(() => resolve()))
  }
}
