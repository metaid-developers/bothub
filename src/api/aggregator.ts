import { getMetaSocketBaseUrl, useAggregatorMock } from '@/api/config'
import type {
  ApiEnvelope,
  GetServiceDetailParams,
  ListServicesParams,
  SkillServiceDetailData,
  SkillServiceListData,
} from '@/api/aggregator.types'
import mockDetailEnvelope from '@/mocks/aggregator/detail.json'
import mockListEnvelope from '@/mocks/aggregator/list.json'

export class AggregatorError extends Error {
  readonly code: number

  constructor(code: number, message: string) {
    super(message)
    this.name = 'AggregatorError'
    this.code = code
  }
}

function unwrapEnvelope<T>(envelope: ApiEnvelope<T>): T {
  if (envelope.code !== 0) {
    throw new AggregatorError(envelope.code, envelope.message)
  }
  if (envelope.data === null) {
    throw new AggregatorError(envelope.code, envelope.message || 'empty data')
  }
  return envelope.data
}

function buildListQuery(params: ListServicesParams = {}): string {
  const search = new URLSearchParams()
  if (params.size !== undefined) search.set('size', String(params.size))
  if (params.cursor) search.set('cursor', params.cursor)
  if (params.keyword) search.set('keyword', params.keyword)
  if (params.currency) search.set('currency', params.currency)
  if (params.chainName) search.set('chainName', params.chainName)
  if (params.outputType) search.set('outputType', params.outputType)
  if (params.providerGlobalMetaId) {
    search.set('providerGlobalMetaId', params.providerGlobalMetaId)
  }
  if (params.sortBy) search.set('sortBy', params.sortBy)
  if (params.order) search.set('order', params.order)
  if (params.includeInactive !== undefined) {
    search.set('includeInactive', String(params.includeInactive))
  }
  const qs = search.toString()
  return qs ? `?${qs}` : ''
}

function buildDetailQuery(params: GetServiceDetailParams = {}): string {
  const search = new URLSearchParams()
  if (params.idType) search.set('idType', params.idType)
  if (params.chainName) search.set('chainName', params.chainName)
  const qs = search.toString()
  return qs ? `?${qs}` : ''
}

export async function listServices(
  params: ListServicesParams = {},
): Promise<SkillServiceListData> {
  if (useAggregatorMock()) {
    return unwrapEnvelope(mockListEnvelope as ApiEnvelope<SkillServiceListData>)
  }

  const baseUrl = getMetaSocketBaseUrl().replace(/\/$/, '')
  const url = `${baseUrl}/api/bot-hub/skill-service/list${buildListQuery(params)}`
  const response = await fetch(url)
  const envelope = (await response.json()) as ApiEnvelope<SkillServiceListData>
  return unwrapEnvelope(envelope)
}

export async function getServiceDetail(
  serviceId: string,
  params: GetServiceDetailParams = {},
): Promise<SkillServiceDetailData> {
  if (useAggregatorMock()) {
    return unwrapEnvelope(mockDetailEnvelope as ApiEnvelope<SkillServiceDetailData>)
  }

  const baseUrl = getMetaSocketBaseUrl().replace(/\/$/, '')
  const encodedId = encodeURIComponent(serviceId)
  const url = `${baseUrl}/api/bot-hub/skill-service/detail/${encodedId}${buildDetailQuery(params)}`
  const response = await fetch(url)
  const envelope = (await response.json()) as ApiEnvelope<SkillServiceDetailData>
  return unwrapEnvelope(envelope)
}
