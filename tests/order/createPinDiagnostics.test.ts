import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  buildCreatePinDiagnostic,
  CREATE_PIN_DIAGNOSTICS_STORAGE_KEY,
  getLastCreatePinDiagnostic,
  recordCreatePinDiagnostic,
} from '@/order/createPinDiagnostics'
import { clearTestSessionStorage } from '../setup'

const context = {
  service: {
    id: 'svc-free-1',
    serviceName: 'free-blueprint',
    displayName: 'Free Blueprint',
    providerSkill: 'blueprint-skill',
  },
  provider: {
    globalMetaId: 'idqprovider',
    name: 'Dan Mercier',
  },
  payment: {
    paymentTxid: '',
    orderReference: 'free-order-ref-1',
  },
  sessionKey: 'idqprovider:free-order-ref-1',
}

describe('createPin diagnostics', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    clearTestSessionStorage()
    delete window.__bothubLastCreatePinDiagnostic
  })

  it('summarizes createPin results without storing encrypted order material', () => {
    const diagnostic = buildCreatePinDiagnostic({
      phase: 'failure_envelope',
      context,
      result: {
        error: {
          message: 'user canceled',
          body: 'raw-simplemsg-body',
          encryptedContent: 'ciphertext-secret',
          orderPayload: 'plain order with buyer prompt',
          chatPubkey: '04' + 'aa'.repeat(64),
        },
        data: {
          txid: 'f'.repeat(64),
        },
      },
      failureMessage: 'user canceled',
    })

    const serialized = JSON.stringify(diagnostic)

    expect(diagnostic).toMatchObject({
      phase: 'failure_envelope',
      serviceId: 'svc-free-1',
      serviceName: 'free-blueprint',
      providerGlobalMetaId: 'idqprovider',
      providerName: 'Dan Mercier',
      orderReference: 'free-order-ref-1',
      failureMessage: 'user canceled',
      txidCandidates: ['f'.repeat(64)],
    })
    expect(serialized).not.toContain('raw-simplemsg-body')
    expect(serialized).not.toContain('ciphertext-secret')
    expect(serialized).not.toContain('plain order with buyer prompt')
    expect(serialized).not.toContain('04' + 'aa'.repeat(64))
  })

  it('records only recent diagnostics and exposes the last one for local debugging', () => {
    const first = buildCreatePinDiagnostic({
      phase: 'resolved',
      context,
      result: { message: 'task finished' },
    })
    const second = buildCreatePinDiagnostic({
      phase: 'rejected',
      context,
      error: new Error('message channel closed before a response was received'),
    })

    recordCreatePinDiagnostic(first)
    recordCreatePinDiagnostic(second)

    expect(getLastCreatePinDiagnostic()).toMatchObject({
      phase: 'rejected',
      errorMessage: 'message channel closed before a response was received',
    })
    expect(window.__bothubLastCreatePinDiagnostic).toMatchObject({
      phase: 'rejected',
    })
    expect(JSON.parse(sessionStorage.getItem(CREATE_PIN_DIAGNOSTICS_STORAGE_KEY) ?? '[]')).toEqual([
      first,
      second,
    ])
  })
})
