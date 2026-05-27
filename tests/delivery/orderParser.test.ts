import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { buildOrderPayload } from '@/order/buildOrderPayload'
import {
  getOrderCorrelationId,
  isOrderMessage,
  parseOrderMessage,
} from '@/delivery/orderParser'

const fixtureDir = join(dirname(fileURLToPath(import.meta.url)), '../fixtures/order')

function readFixture(name: string): string {
  return readFileSync(join(fixtureDir, `${name}.txt`), 'utf8')
}

describe('orderParser', () => {
  it('detects [ORDER] prefix', () => {
    expect(isOrderMessage(readFixture('free'))).toBe(true)
    expect(isOrderMessage('hello world')).toBe(false)
  })

  it('parses free order fixture fields', () => {
    const parsed = parseOrderMessage(readFixture('free'))
    expect(parsed).not.toBeNull()
    expect(parsed?.displaySummary).toBe('Free fortune reading')
    expect(parsed?.rawRequest).toContain('Born 1990-05-12')
    expect(parsed?.price).toBe('0')
    expect(parsed?.currency).toBe('SPACE')
    expect(parsed?.orderReference).toBe('a'.repeat(64))
    expect(parsed?.paymentTxid).toBe('')
    expect(parsed?.serviceId).toBe('pin-free-001')
    expect(parsed?.skillName).toBe('zhuwei-fortune')
    expect(getOrderCorrelationId(parsed!)).toBe('a'.repeat(64))
  })

  it('parses paid native order with payment txid', () => {
    const parsed = parseOrderMessage(readFixture('native-space'))
    expect(parsed?.paymentTxid).toBe('b'.repeat(64))
    expect(getOrderCorrelationId(parsed!)).toBe('b'.repeat(64))
  })

  it('round-trips buildOrderPayload output', () => {
    const payload = buildOrderPayload({
      displayText: 'Round trip',
      rawRequest: 'Do the thing',
      price: '2',
      currency: 'SPACE',
      paymentTxid: 'f'.repeat(64),
      serviceId: 'pin-rt',
      skillName: 'rt-skill',
      outputType: 'text',
    })
    const parsed = parseOrderMessage(payload)
    expect(parsed?.displaySummary).toBe('Round trip')
    expect(parsed?.rawRequest).toBe('Do the thing')
    expect(parsed?.price).toBe('2')
    expect(parsed?.currency).toBe('SPACE')
    expect(parsed?.paymentTxid).toBe('f'.repeat(64))
    expect(parsed?.serviceId).toBe('pin-rt')
    expect(parsed?.skillName).toBe('rt-skill')
  })
})
