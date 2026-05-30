import {
  listPrivateChatHistory,
  listPrivateChatHomes,
  resolvePrivateChatMetaId,
} from '@/api/privateChat'
import { fetchUserProfileByGlobalMetaId } from '@/api/userProfile'
import { getOrdersForWallet, getSessionsForWallet, putSyncState } from '@/delivery/db'
import { decryptIncoming } from '@/delivery/decrypt'
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

type PeerChatPublicKeyCache = Map<string, Promise<string | undefined>>

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

function peerChatPublicKeyFromMemory(peerGlobalMetaId: string): string | undefined {
  const messages = useMessageStore.getState().byPeer[peerGlobalMetaId.trim()] ?? []
  return [...messages]
    .reverse()
    .find((message) => message.peerChatPubkey?.trim())
    ?.peerChatPubkey?.trim()
}

async function peerChatPublicKeyFromLocalDb(input: {
  walletGlobalMetaId: string
  peerGlobalMetaId: string
}): Promise<string | undefined> {
  const wallet = input.walletGlobalMetaId.trim()
  const peer = input.peerGlobalMetaId.trim()
  if (!wallet || !peer) return undefined

  const sessions = await getSessionsForWallet(wallet)
  const sessionKey = sessions.find(
    (session) =>
      session.providerGlobalMetaId.trim() === peer &&
      session.providerChatPubkey?.trim(),
  )?.providerChatPubkey?.trim()
  if (sessionKey) return sessionKey

  const orders = await getOrdersForWallet(wallet)
  return orders.find(
    (order) =>
      order.providerGlobalMetaId.trim() === peer &&
      order.providerChatPubkey?.trim(),
  )?.providerChatPubkey?.trim()
}

async function resolvePeerChatPublicKey(input: {
  item: PrivateChatItem
  selfGlobalMetaId: string
  selfAliases: readonly string[]
  peerGlobalMetaId: string
  cache: PeerChatPublicKeyCache
  pushDebug?: (line: string) => void
}): Promise<string | undefined> {
  const fromMessage = peerChatPublicKeyFromPrivateChat(
    input.item,
    input.selfGlobalMetaId,
    input.selfAliases,
  )
  if (fromMessage) return fromMessage

  const peerGlobalMetaId = input.peerGlobalMetaId.trim()
  if (!peerGlobalMetaId) return undefined

  let cached = input.cache.get(peerGlobalMetaId)
  if (!cached) {
    cached = (async () => {
      const fromMemory = peerChatPublicKeyFromMemory(peerGlobalMetaId)
      if (fromMemory) return fromMemory

      try {
        const fromDb = await peerChatPublicKeyFromLocalDb({
          walletGlobalMetaId: input.selfGlobalMetaId,
          peerGlobalMetaId,
        })
        if (fromDb) return fromDb
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error)
        input.pushDebug?.(
          `[cache] peer chat key was not loaded for ${peerGlobalMetaId.slice(0, 8)}…: ${detail}`,
        )
      }

      try {
        const profile = await fetchUserProfileByGlobalMetaId(peerGlobalMetaId)
        return profile.chatPubkey?.trim() || undefined
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error)
        input.pushDebug?.(
          `[profile] peer chat key was not loaded for ${peerGlobalMetaId.slice(0, 8)}…: ${detail}`,
        )
        return undefined
      }
    })()
    input.cache.set(peerGlobalMetaId, cached)
  }
  return cached
}

async function privateChatToDeliveryMessage(input: {
  item: PrivateChatItem
  selfGlobalMetaId: string
  walletIdentity: WalletIdentity
  pushDebug?: (line: string) => void
  peerChatPublicKeyCache?: PeerChatPublicKeyCache
}): Promise<DeliveryMessage> {
  const self = input.selfGlobalMetaId.trim()
  const selfAliases = selfAliasesForWallet(input.walletIdentity)
  const selfAliasSet = new Set(selfAliases)
  const peerGlobalMetaId = peerGlobalMetaIdFromPrivateChat(
    input.item,
    self,
    selfAliases,
  )
  const peerChatPubKey = await resolvePeerChatPublicKey({
    item: input.item,
    selfGlobalMetaId: self,
    selfAliases,
    peerGlobalMetaId,
    cache: input.peerChatPublicKeyCache ?? new Map(),
    pushDebug: input.pushDebug,
  })
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

  return {
    id: messageIdFromPrivateChat(input.item),
    peerGlobalMetaId,
    peerChatPubkey: peerChatPubKey,
    fromGlobalMetaId,
    toGlobalMetaId,
    content: plaintext || rawContent,
    rawContent,
    encryption: input.item.encryption ?? '',
    contentType: input.item.contentType ?? 'text/plain',
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
  peerChatPublicKeyCache?: PeerChatPublicKeyCache
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
  const peerChatPublicKeyCache: PeerChatPublicKeyCache = new Map()

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
