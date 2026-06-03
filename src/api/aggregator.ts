import { getNormalizedMetaSocketBaseUrl, isAggregatorMockEnabled } from '@/api/config'
import type {
  ApiEnvelope,
  GetServiceDetailParams,
  ListServicesParams,
  ProviderInfo,
  SkillServiceDetailData,
  SkillServiceListItem,
  SkillServiceListData,
} from '@/api/aggregator.types'
import {
  fetchUserProfileByGlobalMetaId,
  normalizeAvatarUrl,
  type UserProfile,
} from '@/api/userProfile'
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

function cleanString(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim()
  return trimmed || undefined
}

function providerLookupKey(item: SkillServiceListItem | ProviderInfo): string | undefined {
  return (
    cleanString('providerGlobalMetaId' in item ? item.providerGlobalMetaId : item.globalMetaId) ??
    cleanString('providerAddress' in item ? item.providerAddress : item.address) ??
    cleanString('providerMetaId' in item ? item.providerMetaId : item.metaid)
  )
}

async function fetchProviderProfile(key: string): Promise<UserProfile | null> {
  try {
    return await fetchUserProfileByGlobalMetaId(key)
  } catch {
    return null
  }
}

function hydrateListItem(
  item: SkillServiceListItem,
  profile: UserProfile | null | undefined,
): SkillServiceListItem {
  return {
    ...item,
    providerName: cleanString(profile?.name) ?? item.providerName,
    providerAvatar:
      cleanString(profile?.avatarUrl) ??
      normalizeAvatarUrl(cleanString(item.providerAvatar)) ??
      item.providerAvatar,
    providerChatPubkey: cleanString(profile?.chatPubkey) ?? item.providerChatPubkey,
  }
}

async function hydrateListData(data: SkillServiceListData): Promise<SkillServiceListData> {
  // MRC20 checkout is not supported yet — hide these services from the UI.
  const filtered = data.list.filter((item) => item.settlementKind !== 'mrc20')

  const keys = Array.from(
    new Set(
      filtered
        .map((item) => providerLookupKey(item))
        .filter((key): key is string => Boolean(key)),
    ),
  )
  if (keys.length === 0) return { ...data, list: filtered }

  const profiles = new Map(
    await Promise.all(keys.map(async (key) => [key, await fetchProviderProfile(key)] as const)),
  )

  return {
    ...data,
    list: filtered.map((item) => hydrateListItem(item, profiles.get(providerLookupKey(item) ?? ''))),
  }
}

function hydrateProvider(
  provider: ProviderInfo,
  profile: UserProfile | null | undefined,
): ProviderInfo {
  return {
    ...provider,
    name: cleanString(profile?.name) ?? provider.name,
    avatar:
      cleanString(profile?.avatarUrl) ??
      normalizeAvatarUrl(cleanString(provider.avatar)) ??
      provider.avatar,
    chatPubkey: cleanString(profile?.chatPubkey) ?? provider.chatPubkey,
  }
}

async function hydrateDetailData(data: SkillServiceDetailData): Promise<SkillServiceDetailData> {
  const key = providerLookupKey(data.provider)
  if (!key) {
    return {
      ...data,
      provider: hydrateProvider(data.provider, null),
    }
  }
  const profile = await fetchProviderProfile(key)
  return {
    ...data,
    provider: hydrateProvider(data.provider, profile),
  }
}

export async function listServices(
  params: ListServicesParams = {},
): Promise<SkillServiceListData> {
  if (isAggregatorMockEnabled()) {
    return unwrapEnvelope(mockListEnvelope as ApiEnvelope<SkillServiceListData>)
  }

  const baseUrl = getNormalizedMetaSocketBaseUrl()
  const url = `${baseUrl}/api/bot-hub/skill-service/list${buildListQuery(params)}`
  const response = await fetch(url)
  const envelope = (await response.json()) as ApiEnvelope<SkillServiceListData>
  return hydrateListData(unwrapEnvelope(envelope))
}

export async function getServiceDetail(
  serviceId: string,
  params: GetServiceDetailParams = {},
): Promise<SkillServiceDetailData> {
  if (isAggregatorMockEnabled()) {
    return unwrapEnvelope(mockDetailEnvelope as ApiEnvelope<SkillServiceDetailData>)
  }

  const baseUrl = getNormalizedMetaSocketBaseUrl()
  const encodedId = encodeURIComponent(serviceId)
  const url = `${baseUrl}/api/bot-hub/skill-service/detail/${encodedId}${buildDetailQuery(params)}`
  const response = await fetch(url)
  const envelope = (await response.json()) as ApiEnvelope<SkillServiceDetailData>
  return hydrateDetailData(unwrapEnvelope(envelope))
}
