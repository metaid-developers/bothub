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
    : input.item.fromGlobalMetaId.trim()
  const toGlobalMetaId = isSelfAlias(input.item.toGlobalMetaId, selfAliasSet)
    ? self
    : input.item.toGlobalMetaId.trim()
  const replyOrderCorrelationId = await resolveReplyOrderCorrelationId({
    walletGlobalMetaId: self,
    peerGlobalMetaId,
    replyPin: input.item.replyPin,
  })

  return {
    id: messageIdFromPrivateChat(input.item),
    peerGlobalMetaId,
    peerChatPubkey: peerChatPubKey,
    peerName: peerProfile.name,
    peerAvatarUrl: peerProfile.avatarUrl,
    fromGlobalMetaId,
    toGlobalMetaId,
    content: plaintext || rawContent,
    rawContent,
    encryption: input.item.encryption ?? '',
    contentType: input.item.contentType ?? 'text/plain',
    orderCorrelationId: replyOrderCorrelationId,
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
  const metaId = resolvePrivateChatMetaId(identity).trim()
  if (!walletGlobalMetaId || !metaId) return summary

  const aliases = new Set(selfAliasesForWallet(identity))
  const homes = await listPrivateChatHomes(metaId)
  const peerChatPublicKeyCache: PeerProfileCache = new Map()

  for (const home of homes) {
    const peerGlobalMetaId = home.globalMetaId.trim() || home.metaId.trim()
    if (!peerGlobalMetaId || aliases.has(peerGlobalMetaId)) continue

    try {
      const page = await listPrivateChatHistory({
        metaId,
        otherMetaId: peerGlobalMetaId,
        cursor: '',
        size: 50,
      })

      let fullyPersisted = true
      let persistenceError: unknown
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
      if (!fullyPersisted) {
        summary.failedPeers.push({
          peerGlobalMetaId,
          error: persistenceError ?? new Error('private chat history was not persisted'),
        })
        continue
      }

      const newestTimestamp = page.list.reduce<number | undefined>(
        (max, item) =>
          max === undefined || item.timestamp > max ? item.timestamp : max,
        undefined,
      )
      await putSyncState({
        id: `${walletGlobalMetaId}:${peerGlobalMetaId}`,
        walletGlobalMetaId,
        peerGlobalMetaId,
        cursor: page.nextCursor ?? undefined,
        lastTimestamp: newestTimestamp,
        updatedAt: Date.now(),
      })
      summary.syncedPeers.push(peerGlobalMetaId)
    } catch (error) {
      summary.failedPeers.push({ peerGlobalMetaId, error })
      continue
    }
  }

  return summary
}
