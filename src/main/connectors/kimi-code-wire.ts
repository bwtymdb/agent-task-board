import { openSync, readSync, statSync } from 'node:fs'
import type { Light } from '../../shared/types.ts'

export type WireStatus = { light: Light; reason: string; updatedAt: number }
type WireRecord = { type?: string; reason?: string; event?: { type?: string } }

export function parseWireEvents(records: WireRecord[]): Omit<WireStatus, 'updatedAt'> {
  let light: Light = 'green'
  let reason = '本轮完成 / 空闲'
  for (const record of records) {
    const type = record.type || record.event?.type || ''
    if (type === 'agent.turn.started') {
      light = 'yellow'
      reason = '进行中'
    } else if (type === 'turn.ended') {
      light = record.reason === 'failed' ? 'red' : 'green'
      reason = record.reason === 'failed' ? '执行失败，需检查' : '本轮完成 / 空闲'
    } else if (/permission\.request|interaction\.request|question\.request/i.test(type)) {
      light = 'red'
      reason = '需要确认或处理'
    } else if (/permission\.(result|response)|interaction\.(result|response)|question\.(result|response)/i.test(type)) {
      light = 'yellow'
      reason = '进行中'
    }
  }
  return { light, reason }
}

export function readWireStatus(filePath: string): WireStatus | undefined {
  try {
    const size = statSync(filePath).size
    const length = Math.min(size, 2 * 1024 * 1024)
    const buffer = Buffer.alloc(length)
    const fd = openSync(filePath, 'r')
    readSync(fd, buffer, 0, length, Math.max(0, size - length))
    const records = buffer.toString('utf8').split(/\r?\n/).flatMap(line => {
      try { return [JSON.parse(line) as WireRecord] } catch { return [] }
    })
    if (!records.length) return undefined
    return { ...parseWireEvents(records), updatedAt: statSync(filePath).mtimeMs }
  } catch {
    return undefined
  }
}
