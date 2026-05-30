import { describe, expect, it } from 'vitest'
import {
  getResolvedCreatePinFailureMessage,
  resolvePrimaryPinId,
} from '@/order/pinResult'

describe('pinResult', () => {
  it('detects resolved createPin failure envelopes when no pin id is parseable', () => {
    expect(
      getResolvedCreatePinFailureMessage({
        status: 'failed',
        message: 'insufficient balance',
      }),
    ).toMatch(/insufficient balance/i)
    expect(getResolvedCreatePinFailureMessage({ error: 'user canceled' })).toMatch(
      /user canceled/i,
    )
    expect(getResolvedCreatePinFailureMessage({ code: 'not-connected' })).toMatch(
      /not-connected/i,
    )
  })

  it('does not treat successful terminal statuses as failure envelopes', () => {
    expect(getResolvedCreatePinFailureMessage({ status: 'Task Finished' })).toBe('')
    expect(getResolvedCreatePinFailureMessage({ status: 'success' })).toBe('')
    expect(getResolvedCreatePinFailureMessage({ code: 'ok', message: 'done' })).toBe('')
  })

  it('lets parseable pin ids win over failure-looking envelope text', () => {
    const result = {
      pinId: 'a'.repeat(64) + 'i0',
      status: 'failed',
      message: 'failed after retry but pin was created',
    }

    expect(resolvePrimaryPinId(result)).toBe(`${'a'.repeat(64)}i0`)
    expect(getResolvedCreatePinFailureMessage(result)).toBe('')
  })
})
