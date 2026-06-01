import { getNormalizedMetaSocketBaseUrl } from '@/api/config'
import type { ApiEnvelope } from '@/api/aggregator.types'
import { normalizePrivateChatItem, type PrivateChatItem } from '@/ws/privateChat'
import type { WalletIdentity } from '@/wallet/types'

export interface PrivateChatHistoryParams {
  metaId: string
  otherMetaId: string
  cursor?: string
  size?: number
  timestamp?: number
}

export interface PrivateChatHome {
  metaId: string
  globalMetaId: string
  lastMessage?: PrivateChatItem
}

export interface PrivateChatHistoryPage {
  list: PrivateChatItem[]
  total?: number
  nextCursor?: string
  nextTimestamp?: number
}

export class PrivateChatApiError extends Error {
  readonly code: number

  constructor(code: number, message: string) {
    super(message)
    this.name = 'PrivateChatApiError'
    this.code = code
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function unwrapPrivateChatEnvelope(envelope: ApiEnvelope<unknown>): unknown {
  if (!isRecord(envelope) || typeof envelope.code !== 'number') {
    throw new PrivateChatApiError(0, 'invalid private chat envelope')
  }
  if (envelope.code !== 0) {
    const message =
      typeof envelope.message === 'string' && envelope.message
        ? envelope.message
        : 'private chat request failed'
    throw new PrivateChatApiError(envelope.code, message)
  }
  if (envelope.data === null || envelope.data === undefined) {
    throw new PrivateChatApiError(envelope.code, 'invalid private chat data')
  }
  return envelope.data
}

function parseHomes(data: unknown): PrivateChatHome[] {
  if (!isRecord(data)) {
    throw new PrivateChatApiError(0, 'invalid private chat homes')
  }

  const list = data.list === null ? [] : data.list
  if (!Array.isArray(list)) {
    throw new PrivateChatApiError(0, 'invalid private chat homes')
  }

  return list.map((item) => {
    if (!isRecord(item)) {
      throw new PrivateChatApiError(0, 'invalid private chat home')
    }

    const { metaId, globalMetaId, lastMessage } = item
    if (typeof metaId !== 'string' || typeof globalMetaId !== 'string') {
      throw new PrivateChatApiError(0, 'invalid private chat home')
    }
    const normalizedLastMessage =
      lastMessage !== undefined ? normalizePrivateChatItem(lastMessage) : null
    if (lastMessage !== undefined && !normalizedLastMessage) {
      throw new PrivateChatApiError(0, 'invalid private chat home')
    }

    return {
      metaId,
      globalMetaId,
      ...(normalizedLastMessage ? { lastMessage: normalizedLastMessage } : {}),
    }
  })
}

function parseHistoryPage(data: unknown): PrivateChatHistoryPage {
  if (!isRecord(data)) {
    throw new PrivateChatApiError(0, 'invalid private chat history')
  }

  const rawList = data.list === null ? [] : data.list
  if (!Array.isArray(rawList)) {
    throw new PrivateChatApiError(0, 'invalid private chat history')
  }

  const list = rawList.map((item) => {
    const normalizedItem = normalizePrivateChatItem(item)
    if (!normalizedItem) {
      throw new PrivateChatApiError(0, 'invalid private chat item')
    }
    return normalizedItem
  })

  if (data.total !== undefined && typeof data.total !== 'number') {
    throw new PrivateChatApiError(0, 'invalid private chat history')
  }
  if (data.nextCursor !== undefined && typeof data.nextCursor !== 'string') {
    throw new PrivateChatApiError(0, 'invalid private chat history')
  }
  if (data.nextTimestamp !== undefined && typeof data.nextTimestamp !== 'number') {
    throw new PrivateChatApiError(0, 'invalid private chat history')
  }

  return {
    list,
    ...(typeof data.total === 'number' ? { total: data.total } : {}),
    ...(typeof data.nextCursor === 'string' ? { nextCursor: data.nextCursor } : {}),
    ...(typeof data.nextTimestamp === 'number'
      ? { nextTimestamp: data.nextTimestamp }
      : {}),
  }
}

function buildHistoryQuery(params: PrivateChatHistoryParams): string {
  const search = new URLSearchParams()
  search.set('metaId', params.metaId)
  search.set('otherMetaId', params.otherMetaId)
  if (params.cursor !== undefined) search.set('cursor', params.cursor)
  if (params.size !== undefined) search.set('size', String(params.size))
  if (params.timestamp !== undefined) search.set('timestamp', String(params.timestamp))
  return search.toString()
}

export function resolvePrivateChatMetaId(identity: WalletIdentity): string {
  return identity.mvcAddress || identity.globalMetaId
}

export async function listPrivateChatHomes(metaId: string): Promise<PrivateChatHome[]> {
  const baseUrl = getNormalizedMetaSocketBaseUrl()
  const encodedMetaId = encodeURIComponent(metaId)
  const url = `${baseUrl}/api/group-chat/chat/homes/${encodedMetaId}`
  const response = await fetch(url)
  const envelope = (await response.json()) as ApiEnvelope<unknown>
  return parseHomes(unwrapPrivateChatEnvelope(envelope))
}

export async function listPrivateChatHistory(
  params: PrivateChatHistoryParams,
): Promise<PrivateChatHistoryPage> {
  const baseUrl = getNormalizedMetaSocketBaseUrl()
  const url = `${baseUrl}/api/group-chat/private-chat-list?${buildHistoryQuery(params)}`
  const response = await fetch(url)
  const envelope = (await response.json()) as ApiEnvelope<unknown>
  return parseHistoryPage(unwrapPrivateChatEnvelope(envelope))
}
