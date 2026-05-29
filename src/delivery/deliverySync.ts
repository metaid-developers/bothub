import {
  listPrivateChatHistory,
  listPrivateChatHomes,
  resolvePrivateChatMetaId,
} from '@/api/privateChat'
import { putSyncState } from '@/delivery/db'
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

async function privateChatToDeliveryMessage(input: {
  item: PrivateChatItem
  selfGlobalMetaId: string
  walletIdentity: WalletIdentity
  pushDebug?: (line: string) => void
}): Promise<DeliveryMessage> {
  const self = input.selfGlobalMetaId.trim()
  const selfAliases = selfAliasesForWallet(input.walletIdentity)
  const selfAliasSet = new Set(selfAliases)
  const peerGlobalMetaId = peerGlobalMetaIdFromPrivateChat(
    input.item,
    self,
    selfAliases,
  )
  const peerChatPubKey = peerChatPublicKeyFromPrivateChat(
    input.item,
    self,
    selfAliases,
  )
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
