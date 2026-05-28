import { describe, expect, it } from 'vitest'
import listEnvelope from '../fixtures/meta-socket/service-list-live-shape.json'
import detailEnvelope from '../fixtures/meta-socket/service-detail-live-shape.json'

describe('meta-socket live contract fixtures', () => {
  it('keeps the skill-service list envelope shape stable', () => {
    expect(listEnvelope.code).toBe(0)
    expect(listEnvelope.data?.schemaVersion).toBe('botHubSkillService.v1')
    expect(Array.isArray(listEnvelope.data?.list)).toBe(true)

    const firstService = listEnvelope.data?.list[0]
    expect(firstService).toEqual(
      expect.objectContaining({
        id: expect.any(String),
        serviceName: expect.any(String),
        providerGlobalMetaId: expect.any(String),
        paymentAddress: expect.any(String),
      }),
    )
  })

  it('keeps the skill-service detail envelope shape stable', () => {
    expect(detailEnvelope.code).toBe(0)
    expect(detailEnvelope.data?.schemaVersion).toBe('botHubSkillServiceDetail.v1')
    expect(detailEnvelope.data?.service).toEqual(
      expect.objectContaining({
        id: expect.any(String),
        serviceName: expect.any(String),
        paymentAddress: expect.any(String),
      }),
    )
    expect(detailEnvelope.data?.provider).toEqual(
      expect.objectContaining({
        globalMetaId: expect.any(String),
        metaid: expect.any(String),
      }),
    )
  })
})
