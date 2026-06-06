import { describe, expect, it } from 'vitest'
import listEnvelope from '../fixtures/metaso-p2p/service-list-live-shape.json'
import detailEnvelope from '../fixtures/metaso-p2p/service-detail-live-shape.json'
import privateChatHomesEnvelope from '../fixtures/metaso-p2p/private-chat-homes-live-shape.json'
import privateChatListEnvelope from '../fixtures/metaso-p2p/private-chat-list-live-shape.json'
import privateChatListByIndexEnvelope from '../fixtures/metaso-p2p/private-chat-list-by-index-live-shape.json'
import { isPrivateChatItem } from '../../src/ws/privateChat'

function expectPrivateChatItemShape(value: unknown) {
  expect(isPrivateChatItem(value)).toBe(true)
  expect(value).toEqual(
    expect.objectContaining({
      fromGlobalMetaId: expect.any(String),
      toGlobalMetaId: expect.any(String),
      content: expect.any(String),
      timestamp: expect.any(Number),
    }),
  )
}

describe('metaso-p2p live contract fixtures', () => {
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

  it('keeps the private chat homes envelope shape stable', () => {
    expect(privateChatHomesEnvelope.code).toBe(0)
    expect(Array.isArray(privateChatHomesEnvelope.data?.list)).toBe(true)

    const firstHome = privateChatHomesEnvelope.data?.list[0]
    expect(firstHome).toEqual(
      expect.objectContaining({
        metaId: expect.any(String),
        globalMetaId: expect.any(String),
      }),
    )

    if (firstHome?.lastMessage) {
      expectPrivateChatItemShape(firstHome.lastMessage)
    }
  })

  it('keeps the private chat list envelope shape stable', () => {
    expect(privateChatListEnvelope.code).toBe(0)
    expect(Array.isArray(privateChatListEnvelope.data?.list)).toBe(true)
    expect(privateChatListEnvelope.data?.list.length).toBeGreaterThan(0)

    for (const row of privateChatListEnvelope.data?.list ?? []) {
      expectPrivateChatItemShape(row)
    }
  })

  it('keeps the private-chat-list-by-index route shape stable', () => {
    const route =
      '/api/group-chat/private-chat-list-by-index?metaId=1JzFmwf498bXRyFiJTrxikSP7xh9iZ3JrX&otherMetaId=idq160rca8swdygt7hn59em03nqhr96zmjd4yd668z&startIndex=0&size=20'
    const query = new URLSearchParams(route.split('?')[1])

    expect(route).toContain('/api/group-chat/private-chat-list-by-index?')
    expect(query.get('startIndex')).toBe('0')
    expect(privateChatListByIndexEnvelope.code).toBe(0)
    expect(Array.isArray(privateChatListByIndexEnvelope.data?.list)).toBe(true)
    expect(privateChatListByIndexEnvelope.data?.list.length).toBeGreaterThan(0)

    for (const row of privateChatListByIndexEnvelope.data?.list ?? []) {
      expectPrivateChatItemShape(row)
    }
  })
})
