import {
  listPrivateChatHistory,
  listPrivateChatHomes,
  resolvePrivateChatMetaId,
} from '@/api/privateChat'
import {
  fetchUserProfileByGlobalMetaId,
} from '@/api/userProfile'
import {
  getMessagesForSession,
  getOrdersForWallet,
  getSessionsForWallet,
  putSyncState,
} from '@/delivery/db'
import { decryptIncoming } from '@/delivery/decrypt'
import {
  findCorrelationInText,
  getOrderCorrelationId,
  parseOrderMessage,
} from '@/delivery/orderParser'
import {
  mergePeerProfiles,
  peerProfileFromPrivateChatUserInfo,
  peerProfileFromUserProfile,
  peerProfileNeedsHydration,
  type PeerProfile,
} from '@/delivery/peerProfile'
import {
  persistDeliveryMessage,
  useMessageStore,
  type DeliveryMessage,
} from '@/delivery/messageStore'
import { parseDeliveryProtocol } from '@/delivery/protocol'
import type { WalletIdentity } from '@/wallet/types'
import {
  messageIdFromPrivateChat,
  peerChatPublicKeyFromPrivateChat,
  peerGlobalMetaIdFromPrivateChat,
  type PrivateChatItem,
  type PrivateChatUserInfo,
} from '@/ws/privateChat'

export interface MergePrivateChatResult {
  message: DeliveryMessage
  persisted: boolean
  persistenceError?: unknown
}

export interface PrivateChatHistorySyncSummary {
  syncedPeers: string[]
  failedPeers: Array<{ peerGlobalMetaId: string; error: unknown }>
}

type PeerProfileCache = Map<string, Promise<PeerProfile>>

function selfAliasesForWallet(identity: WalletIdentity): string[] {
  return Array.from(
    new Set(
      [
        identity.globalMetaId,
        identity.mvcAddress,
        resolvePrivateChatMetaId(identity),
      ]
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  )
}

function privateChatMetaIdsForWallet(identity: WalletIdentity): string[] {
  return Array.from(
    new Set(
      [
        identity.globalMetaId,
        resolvePrivateChatMetaId(identity),
        identity.mvcAddress,
      ]
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  )
}

function isSelfAlias(value: string, aliases: ReadonlySet<string>): boolean {
  return aliases.has(value.trim())
}

function peerProfileFromMemory(peerGlobalMetaId: string): PeerProfile {
  const messages = useMessageStore.getState().byPeer[peerGlobalMetaId.trim()] ?? []
  return [...messages].reverse().reduce<PeerProfile>((profile, message) => {
    if (!profile.chatPubkey) profile.chatPubkey = message.peerChatPubkey?.trim() || undefined
    if (!profile.name) profile.name = message.peerName?.trim() || undefined
    if (!profile.avatarUrl) profile.avatarUrl = message.peerAvatarUrl?.trim() || undefined
    return profile
  }, {})
}

async function peerProfileFromLocalDb(input: {
  walletGlobalMetaId: string
  peerGlobalMetaId: string
}): Promise<PeerProfile> {
  const wallet = input.walletGlobalMetaId.trim()
  const peer = input.peerGlobalMetaId.trim()
  if (!wallet || !peer) return {}

  const sessions = await getSessionsForWallet(wallet)
  const sessionProfile = sessions.find(
    (session) =>
      session.providerGlobalMetaId.trim() === peer &&
      (session.providerChatPubkey?.trim() ||
        session.providerName?.trim() ||
        session.providerAvatarUrl?.trim()),
  )
  if (sessionProfile) {
    return {
      chatPubkey: sessionProfile.providerChatPubkey?.trim() || undefined,
      name: sessionProfile.providerName?.trim() || undefined,
      avatarUrl: sessionProfile.providerAvatarUrl?.trim() || undefined,
    }
  }

  const orders = await getOrdersForWallet(wallet)
  const orderProfile = orders.find(
    (order) =>
      order.providerGlobalMetaId.trim() === peer &&
      (order.providerChatPubkey?.trim() ||
        order.providerName?.trim() ||
        order.providerAvatarUrl?.trim()),
  )
  return {
    chatPubkey: orderProfile?.providerChatPubkey?.trim() || undefined,
    name: orderProfile?.providerName?.trim() || undefined,
    avatarUrl: orderProfile?.providerAvatarUrl?.trim() || undefined,
  }
}

function peerUserInfoFromPrivateChat(
  item: PrivateChatItem,
  selfGlobalMetaId: string,
  selfAliases: readonly string[],
): PrivateChatUserInfo | undefined {
  const selfIds = new Set([selfGlobalMetaId, ...selfAliases].map((value) => value.trim()))
  return selfIds.has(item.fromGlobalMetaId.trim()) ? item.toUserInfo : item.fromUserInfo
}

async function resolvePeerProfile(input: {
  item: PrivateChatItem
  selfGlobalMetaId: string
  selfAliases: readonly string[]
  peerGlobalMetaId: string
  cache: PeerProfileCache
  pushDebug?: (line: string) => void
}): Promise<PeerProfile> {
  const fromMessage = mergePeerProfiles(
    peerProfileFromPrivateChatUserInfo(
      peerUserInfoFromPrivateChat(input.item, input.selfGlobalMetaId, input.selfAliases),
    ),
    {
      chatPubkey: peerChatPublicKeyFromPrivateChat(
        input.item,
        input.selfGlobalMetaId,
        input.selfAliases,
      ),
    },
  )
  if (!peerProfileNeedsHydration(fromMessage)) {
    return fromMessage
  }

  const peerGlobalMetaId = input.peerGlobalMetaId.trim()
  if (!peerGlobalMetaId) return fromMessage

  let cached = input.cache.get(peerGlobalMetaId)
  if (!cached) {
    cached = (async () => {
      const withMemory = mergePeerProfiles(fromMessage, peerProfileFromMemory(peerGlobalMetaId))
      if (!peerProfileNeedsHydration(withMemory)) {
        return withMemory
      }

      let withFallback = withMemory
      try {
        withFallback = mergePeerProfiles(
          withMemory,
          await peerProfileFromLocalDb({
            walletGlobalMetaId: input.selfGlobalMetaId,
            peerGlobalMetaId,
          }),
        )
        if (!peerProfileNeedsHydration(withFallback)) return withFallback
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error)
        input.pushDebug?.(
          `[cache] peer profile was not loaded for ${peerGlobalMetaId.slice(0, 8)}…: ${detail}`,
        )
      }

      try {
        const profile = await fetchUserProfileByGlobalMetaId(peerGlobalMetaId)
        return mergePeerProfiles(withFallback, peerProfileFromUserProfile(profile))
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error)
        input.pushDebug?.(
          `[profile] peer chat key was not loaded for ${peerGlobalMetaId.slice(0, 8)}…: ${detail}`,
        )
        return withFallback
      }
    })()
    input.cache.set(peerGlobalMetaId, cached)
  }
  return mergePeerProfiles(fromMessage, await cached)
}

async function resolveReplyOrderCorrelationId(input: {
  walletGlobalMetaId: string
  peerGlobalMetaId: string
  replyPin?: string
}): Promise<string | undefined> {
  const wallet = input.walletGlobalMetaId.trim()
  const peer = input.peerGlobalMetaId.trim()
  const replyPin = input.replyPin?.trim()
  if (!wallet || !peer || !replyPin) return undefined

  const sessions = await getSessionsForWallet(wallet)
  const peerSessions = sessions.filter(
    (session) => session.providerGlobalMetaId.trim() === peer,
  )
  for (const session of peerSessions) {
    const messages = await getMessagesForSession(session.id)
    const matched = messages.find(
      (record) => record.pinId?.trim() === replyPin || record.id.trim() === replyPin,
    )
    if (!matched) continue
    return matched.orderCorrelationId?.trim() || session.orderCorrelationId?.trim() || undefined
  }

  return undefined
}

function compositeIdTail(id: string): string {
  const trimmed = id.trim()
  const colon = trimmed.lastIndexOf(':')
  return colon >= 0 ? trimmed.slice(colon + 1).trim() : trimmed
}

function addKnownCorrelation(
  known: Map<string, string>,
  value: string | null | undefined,
  canonical: string | null | undefined,
): void {
  const rawValue = value?.trim()
  const rawCanonical = canonical?.trim()
  if (!rawValue || !rawCanonical) return
  known.set(rawValue, rawCanonical)
}

async function resolveKnownOrderCorrelationId(input: {
  walletGlobalMetaId: string
  peerGlobalMetaId: string
  content: string
}): Promise<string | undefined> {
  const wallet = input.walletGlobalMetaId.trim()
  const peer = input.peerGlobalMetaId.trim()
  if (!wallet || !peer) return undefined

  const known = new Map<string, string>()
  const [sessions, orders] = await Promise.all([
    getSessionsForWallet(wallet),
    getOrdersForWallet(wallet),
  ])

  for (const session of sessions) {
    if (session.providerGlobalMetaId.trim() !== peer) continue
    const canonical = session.orderCorrelationId?.trim() || compositeIdTail(session.id)
    if (!canonical || canonical === 'uncorrelated') continue
    addKnownCorrelation(known, session.orderCorrelationId, canonical)
    addKnownCorrelation(known, session.id, canonical)
  }

  for (const order of orders) {
    if (order.providerGlobalMetaId.trim() !== peer) continue
    const canonical =
      order.orderPinId?.trim() ||
      order.paymentTxid?.trim() ||
      order.orderReference?.trim() ||
      compositeIdTail(order.id)
    if (!canonical) continue
    addKnownCorrelation(known, canonical, canonical)
    addKnownCorrelation(known, order.paymentTxid, canonical)
    addKnownCorrelation(known, order.paymentCommitTxid, canonical)
    addKnownCorrelation(known, order.orderReference, canonical)
    addKnownCorrelation(known, order.orderPinId, canonical)
    addKnownCorrelation(known, order.id, canonical)
  }

  const protocolCorrelation = parseDeliveryProtocol(input.content).orderCorrelationId.trim()
  if (protocolCorrelation) return known.get(protocolCorrelation) ?? protocolCorrelation

  const parsedOrder = parseOrderMessage(input.content)
  const orderCorrelation = parsedOrder ? getOrderCorrelationId(parsedOrder).trim() : ''
  if (orderCorrelation) return known.get(orderCorrelation) ?? orderCorrelation

  const textMatch = findCorrelationInText(input.content, new Set(known.keys())).trim()
  return textMatch ? known.get(textMatch) ?? textMatch : undefined
}

async function privateChatToDeliveryMessage(input: {
  item: PrivateChatItem
  selfGlobalMetaId: string
  walletIdentity: WalletIdentity
  pushDebug?: (line: string) => void
  peerChatPublicKeyCache?: PeerProfileCache
}): Promise<DeliveryMessage> {
  const self = input.selfGlobalMetaId.trim()
  const selfAliases = selfAliasesForWallet(input.walletIdentity)
  const selfAliasSet = new Set(selfAliases)
  const peerGlobalMetaId = peerGlobalMetaIdFromPrivateChat(
    input.item,
    self,
    selfAliases,
  )
  const peerProfile = await resolvePeerProfile({
    item: input.item,
    selfGlobalMetaId: self,
    selfAliases,
    peerGlobalMetaId,
    cache: input.peerChatPublicKeyCache ?? new Map(),
    pushDebug: input.pushDebug,
  })
  const canonicalPeerGlobalMetaId = peerProfile.globalMetaId?.trim() || peerGlobalMetaId
  const peerChatPubKey = peerProfile.chatPubkey
  const rawContent = input.item.content
  const { plaintext, error } = await decryptIncoming({
    content: rawContent,
    protocol: input.item.protocol ?? input.item.path,
    encryption: input.item.encryption ?? input.item.encrypt,
    peerChatPubKey,
    messageId: messageIdFromPrivateChat(input.item),
  })

  if (error) {
    input.pushDebug?.(`[decrypt] ${peerGlobalMetaId.slice(0, 8)}…: ${error}`)
  }

  const fromGlobalMetaId = isSelfAlias(input.item.fromGlobalMetaId, selfAliasSet)
    ? self
    : input.item.fromGlobalMetaId.trim() === peerGlobalMetaId
      ? canonicalPeerGlobalMetaId
      : input.item.fromGlobalMetaId.trim()
  const toGlobalMetaId = isSelfAlias(input.item.toGlobalMetaId, selfAliasSet)
    ? self
    : input.item.toGlobalMetaId.trim() === peerGlobalMetaId
      ? canonicalPeerGlobalMetaId
      : input.item.toGlobalMetaId.trim()
  const replyOrderCorrelationId = await resolveReplyOrderCorrelationId({
    walletGlobalMetaId: self,
    peerGlobalMetaId: canonicalPeerGlobalMetaId,
    replyPin: input.item.replyPin,
  })
  const content = plaintext || rawContent
  const orderCorrelationId =
    replyOrderCorrelationId ||
    (await resolveKnownOrderCorrelationId({
      walletGlobalMetaId: self,
      peerGlobalMetaId: canonicalPeerGlobalMetaId,
      content,
    }))

  return {
    id: messageIdFromPrivateChat(input.item),
    peerGlobalMetaId: canonicalPeerGlobalMetaId,
    peerChatPubkey: peerChatPubKey,
    peerName: peerProfile.name,
    peerAvatarUrl: peerProfile.avatarUrl,
    fromGlobalMetaId,
    toGlobalMetaId,
    content,
    rawContent,
    encryption: input.item.encryption ?? '',
    contentType: input.item.contentType ?? 'text/plain',
    orderCorrelationId,
    timestamp: input.item.timestamp,
    pinId: input.item.pinId,
    txId: input.item.txId,
    decryptError: error,
  }
}

export async function hydrateDeliveryForWallet(
  identity: WalletIdentity,
): Promise<void> {
  await useMessageStore.getState().hydrateFromDb(identity.globalMetaId)
}

export async function mergePrivateChatItem(input: {
  item: PrivateChatItem
  selfGlobalMetaId: string
  walletIdentity: WalletIdentity
  pushDebug?: (line: string) => void
  peerChatPublicKeyCache?: PeerProfileCache
}): Promise<MergePrivateChatResult> {
  const message = await privateChatToDeliveryMessage(input)
  useMessageStore.getState().append(message)
  try {
    await persistDeliveryMessage({
      walletGlobalMetaId: input.selfGlobalMetaId,
      message,
    })
    return { message, persisted: true }
  } catch (error) {
    return { message, persisted: false, persistenceError: error }
  }
}

export async function syncKnownPrivateChatHistory(
  identity: WalletIdentity,
): Promise<PrivateChatHistorySyncSummary> {
  const summary: PrivateChatHistorySyncSummary = {
    syncedPeers: [],
    failedPeers: [],
  }
  const walletGlobalMetaId = identity.globalMetaId.trim()
  const metaIds = privateChatMetaIdsForWallet(identity)
  if (!walletGlobalMetaId || metaIds.length === 0) return summary

  const aliases = new Set(selfAliasesForWallet(identity))
  const peerChatPublicKeyCache: PeerProfileCache = new Map()
  const syncedPeerSet = new Set<string>()
  const failedPeerErrors = new Map<string, unknown>()
  const requestedPairs = new Set<string>()

  const recordFailedPeer = (peerGlobalMetaId: string, error: unknown) => {
    const peer = peerGlobalMetaId.trim()
    if (!peer || syncedPeerSet.has(peer)) return
    if (!failedPeerErrors.has(peer)) failedPeerErrors.set(peer, error)
  }

  for (const metaId of metaIds) {
    let homes: Awaited<ReturnType<typeof listPrivateChatHomes>>
    try {
      homes = await listPrivateChatHomes(metaId)
    } catch (error) {
      recordFailedPeer(metaId, error)
      continue
    }

    for (const home of homes) {
      const peerGlobalMetaId = home.globalMetaId.trim() || home.metaId.trim()
      if (!peerGlobalMetaId || aliases.has(peerGlobalMetaId)) continue
      const pairKey = `${metaId}:${peerGlobalMetaId}`
      if (requestedPairs.has(pairKey)) continue
      requestedPairs.add(pairKey)

      try {
        let cursor = ''
        let fullyPersisted = true
        let persistenceError: unknown
        let newestTimestamp: number | undefined

        // Fetch up to 3 pages (150 messages) per peer.
        for (let pageIndex = 0; pageIndex < 3; pageIndex++) {
          const page = await listPrivateChatHistory({
            metaId,
            otherMetaId: peerGlobalMetaId,
            cursor,
            size: 50,
          })

          for (const item of page.list) {
            const result = await mergePrivateChatItem({
              item,
              selfGlobalMetaId: walletGlobalMetaId,
              walletIdentity: identity,
              peerChatPublicKeyCache,
            })
            if (!result.persisted) {
              fullyPersisted = false
              persistenceError = result.persistenceError
            }
          }

          if (page.list.length > 0) {
            const pageNewest = page.list.reduce<number | undefined>(
              (max, item) =>
                max === undefined || item.timestamp > max ? item.timestamp : max,
              undefined,
            )
            if (
              pageNewest !== undefined &&
              (newestTimestamp === undefined || pageNewest > newestTimestamp)
            ) {
              newestTimestamp = pageNewest
            }
          }

          if (!page.nextCursor) break
          cursor = page.nextCursor
        }

        if (!fullyPersisted) {
          recordFailedPeer(
            peerGlobalMetaId,
            persistenceError ?? new Error('private chat history was not persisted'),
          )
          continue
        }

        await putSyncState({
          id: `${walletGlobalMetaId}:${peerGlobalMetaId}`,
          walletGlobalMetaId,
          peerGlobalMetaId,
          cursor,
          lastTimestamp: newestTimestamp,
          updatedAt: Date.now(),
        })
        if (!syncedPeerSet.has(peerGlobalMetaId)) {
          syncedPeerSet.add(peerGlobalMetaId)
          failedPeerErrors.delete(peerGlobalMetaId)
          summary.syncedPeers.push(peerGlobalMetaId)
        }
      } catch (error) {
        recordFailedPeer(peerGlobalMetaId, error)
        continue
      }
    }
  }

  summary.failedPeers = Array.from(failedPeerErrors.entries()).map(
    ([peerGlobalMetaId, error]) => ({ peerGlobalMetaId, error }),
  )
  return summary
}
