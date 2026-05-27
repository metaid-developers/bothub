import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import listFixture from '../fixtures/aggregator/list.json'
import detailFixture from '../fixtures/aggregator/detail.json'
import error40000 from '../fixtures/aggregator/error-40000.json'
import error40400 from '../fixtures/aggregator/error-40400.json'

async function loadAggregator() {
  return import('@/api/aggregator')
}

describe('aggregator client', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  describe('mock mode', () => {
    beforeEach(() => {
      vi.stubEnv('VITE_USE_AGGREGATOR_MOCK', 'true')
      vi.stubEnv('VITE_META_SOCKET_BASE_URL', 'https://api.test')
    })

    it('listServices returns mock list with at least 3 items', async () => {
      const { listServices } = await loadAggregator()
      const data = await listServices()

      expect(data.schemaVersion).toBe('botHubSkillService.v1')
      expect(data.list.length).toBeGreaterThanOrEqual(3)
      expect(data.list[0].currentPinId).toBeTruthy()
      expect(data.list[0].sourceServicePinId).toBeTruthy()
      expect(data.list[0]).toHaveProperty('disabled')
      expect(data.list[0]).not.toHaveProperty('available')
    })

    it('includes null provider fields and MRC20 settlement item', async () => {
      const { listServices } = await loadAggregator()
      const data = await listServices()

      const anon = data.list.find((item) => item.providerName === null)
      expect(anon).toBeDefined()
      expect(anon?.providerAvatar).toBeNull()

      const mrc20 = data.list.find((item) => item.settlementKind === 'mrc20')
      expect(mrc20).toBeDefined()
      expect(mrc20?.currency).toBe('MRC20')
      expect(mrc20?.mrc20Ticker).toBeTruthy()
      expect(mrc20?.mrc20Id).toBeTruthy()
    })

    it('getServiceDetail returns service, provider, and metadata', async () => {
      const { getServiceDetail } = await loadAggregator()
      const data = await getServiceDetail('pin-zhuwei-current-001')

      expect(data.schemaVersion).toBe('botHubSkillServiceDetail.v1')
      expect(data.service.currentPinId).toBe('pin-zhuwei-current-001')
      expect(data.provider.globalMetaId).toBeTruthy()
      expect(data.aggregatedAt).toBeGreaterThan(0)
      expect(data.service).not.toHaveProperty('ratingAvg')
    })
  })

  describe('fetch mode', () => {
    beforeEach(() => {
      vi.stubEnv('VITE_USE_AGGREGATOR_MOCK', 'false')
      vi.stubEnv('VITE_META_SOCKET_BASE_URL', 'https://api.test')
    })

    it('listServices fetches list endpoint and unwraps envelope', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        json: async () => listFixture,
      })
      vi.stubGlobal('fetch', fetchMock)

      const { listServices } = await loadAggregator()
      const data = await listServices({ size: 20, sortBy: 'rating' })

      expect(fetchMock).toHaveBeenCalledOnce()
      expect(fetchMock.mock.calls[0][0]).toBe(
        'https://api.test/api/bot-hub/skill-service/list?size=20&sortBy=rating',
      )
      expect(data.list).toHaveLength(3)
      expect(data.total).toBe(3)
    })

    it('getServiceDetail fetches detail endpoint with encoded id', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        json: async () => detailFixture,
      })
      vi.stubGlobal('fetch', fetchMock)

      const { getServiceDetail } = await loadAggregator()
      const data = await getServiceDetail('fixture-pin-001', { idType: 'currentPinId' })

      expect(fetchMock).toHaveBeenCalledOnce()
      expect(fetchMock.mock.calls[0][0]).toBe(
        'https://api.test/api/bot-hub/skill-service/detail/fixture-pin-001?idType=currentPinId',
      )
      expect(data.service.id).toBe('fixture-pin-001')
      expect(data.provider.name).toBe('Fixture Bot')
    })

    it('throws AggregatorError for 40400 envelope', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({ json: async () => error40400 }),
      )

      const { getServiceDetail, AggregatorError } = await loadAggregator()
      await expect(getServiceDetail('missing-id')).rejects.toMatchObject({
        name: 'AggregatorError',
        code: 40400,
        message: 'service not found',
      })
      await expect(getServiceDetail('missing-id')).rejects.toBeInstanceOf(AggregatorError)
    })

    it('throws AggregatorError for 40000 envelope', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({ json: async () => error40000 }),
      )

      const { listServices } = await loadAggregator()
      await expect(listServices({ cursor: 'bad' })).rejects.toMatchObject({
        code: 40000,
        message: 'invalid parameter',
      })
    })
  })
})
