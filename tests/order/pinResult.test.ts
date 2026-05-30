import { describe, expect, it } from 'vitest'
import {
  getResolvedCreatePinFailureMessage,
  isCreatePinTransportResponseLostError,
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

  it('treats resolved Metalet explorer open-url envelopes as success', () => {
    const txid = 'b'.repeat(64)
    const result = {
      error: {
        code: 'open-url',
        openUrl: `https://www.mvcscan.com/tx/${txid}`,
      },
    }

    expect(resolvePrimaryPinId(result)).toBe(`${txid}i0`)
    expect(getResolvedCreatePinFailureMessage(result)).toBe('')
  })

  it('does not fail resolved Metalet explorer open-url envelopes without a txid', () => {
    const result = {
      error: {
        openUrl: 'https://www.mvcscan.com/',
      },
    }

    expect(resolvePrimaryPinId(result)).toBe('')
    expect(getResolvedCreatePinFailureMessage(result)).toBe('')
  })

  it('classifies Chrome extension createPin response-loss errors as indeterminate', () => {
    expect(
      isCreatePinTransportResponseLostError(
        new Error(
          'A listener indicated an asynchronous response by returning true, but the message channel closed before a response was received',
        ),
      ),
    ).toBe(true)
    expect(
      isCreatePinTransportResponseLostError(
        new Error(
          'Unchecked runtime.lastError: The message port closed before a response was received.',
        ),
      ),
    ).toBe(true)
  })

  it('does not classify missing extension listeners as response loss', () => {
    expect(
      isCreatePinTransportResponseLostError(
        new Error('Could not establish connection. Receiving end does not exist.'),
      ),
    ).toBe(false)
  })

  it('does not classify explicit wallet failures as response loss', () => {
    expect(isCreatePinTransportResponseLostError(new Error('User rejected the request'))).toBe(
      false,
    )
    expect(isCreatePinTransportResponseLostError(new Error('insufficient balance'))).toBe(false)
    expect(isCreatePinTransportResponseLostError(new Error('Order pin broadcast timed out'))).toBe(
      false,
    )
  })
})
