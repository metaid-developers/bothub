import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { buildOrderPayload } from '@/order/buildOrderPayload'

const fixtureDir = join(dirname(fileURLToPath(import.meta.url)), '../fixtures/order')

function readFixture(name: string): string {
  return readFileSync(join(fixtureDir, `${name}.txt`), 'utf8')
}

describe('buildOrderPayload', () => {
  it('matches IDBots golden fixture: free', () => {
    const payload = buildOrderPayload({
      displayText: 'Free fortune reading',
      rawRequest: 'Born 1990-05-12 14:30 in Shanghai',
      price: '0',
      currency: 'SPACE',
      orderReference: 'a'.repeat(64),
      serviceId: 'pin-free-001',
      skillName: 'zhuwei-fortune',
      serviceName: 'free-fortune',
      outputType: 'text',
    })
    expect(payload).toBe(readFixture('free'))
  })

  it('matches IDBots golden fixture: native SPACE', () => {
    const payload = buildOrderPayload({
      displayText: 'Paid fortune reading',
      rawRequest: 'Please analyze my chart for career luck in 2026.',
      price: '1',
      currency: 'SPACE',
      paymentTxid: 'b'.repeat(64),
      paymentChain: 'mvc',
      settlementKind: 'native',
      serviceId: 'pin-space-001',
      skillName: 'zhuwei-fortune',
      serviceName: 'zhuwei-fortune-service',
      outputType: 'text',
    })
    expect(payload).toBe(readFixture('native-space'))
  })

  it('matches IDBots golden fixture: native BTC', () => {
    const payload = buildOrderPayload({
      displayText: 'BTC paid order',
      rawRequest: 'Need BTC settlement test order.',
      price: '0.00001',
      currency: 'BTC',
      paymentTxid: 'c'.repeat(64),
      paymentChain: 'btc',
      settlementKind: 'native',
      serviceId: 'pin-btc-001',
      skillName: 'btc-skill',
      serviceName: 'btc-service',
      outputType: 'text',
    })
    expect(payload).toBe(readFixture('native-btc'))
  })

  it('matches IDBots golden fixture: MRC20', () => {
    const payload = buildOrderPayload({
      displayText: 'MRC20 token order',
      rawRequest: 'Pay with DEMO-MRC20 token.',
      price: '100',
      currency: 'DEMO-MRC20',
      paymentTxid: 'd'.repeat(64),
      paymentCommitTxid: 'e'.repeat(64),
      paymentChain: 'btc',
      settlementKind: 'mrc20',
      mrc20Ticker: 'DEMO',
      mrc20Id: 'mrc20-genesis-id-demo-001',
      serviceId: 'pin-mrc20-001',
      skillName: 'demo-mrc20-skill',
      serviceName: 'demo-mrc20-service',
      outputType: 'image',
    })
    expect(payload).toBe(readFixture('mrc20'))
  })
})
