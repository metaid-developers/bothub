import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import {
  getAssetsForSession,
  getMessagesForSession,
  getSessionsForWallet,
  persistDeliveryMessageRows,
  persistOutgoingFollowUp,
} from '@/delivery/db'
import type {
  DeliveryAssetRecord,
  DeliveryMessageRecord,
} from '@/delivery/domain'
import { buildAssetId, buildSessionId } from '@/delivery/domain'
import type { ParsedDeliveryAsset } from '@/delivery/assetParser'
import {
  findCorrelationInText,
  getOrderCorrelationId,
  parseOrderMessage,
} from '@/delivery/orderParser'
import { parseDeliveryProtocol } from '@/delivery/protocol'
import {
  deriveSessionStatus,
  deliveryAssetsFromMessage,
} from '@/delivery/sessionDisplay'
import {
  buildGroupedSessionList,
  messagesForSession as resolveMessagesForSession,
} from '@/delivery/sessionGrouping'
import type { WalletIdentity } from '@/wallet/types'

export interface DeliveryMessage {
  id: string
  peerGlobalMetaId: string
  peerChatPubkey?: string
  peerName?: string
  peerAvatarUrl?: string
  fromGlobalMetaId: string
  toGlobalMetaId: string
  /** Display text (decrypted when possible). */
  content: string
  /** Original on-chain / WS ciphertext (never dropped). */
  rawContent: string
  encryption: string
  contentType: string
  orderCorrelationId?: string
  timestamp: number
  pinId?: string
  txId?: string
  decryptError?: string
}

export interface DeliverySession {
  sessionKey: string
  peerGlobalMetaId: string
  providerChatPubkey?: string
  peerName?: string
  peerAvatarUrl?: string
  orderCorrelationId: string | null
  serviceLabel: string | null
  lastMessage: DeliveryMessage
  messageCount: number
}

export interface FollowUpSessionInput {
  sessionKey: string
  peerGlobalMetaId: string
  providerChatPubkey?: string
  peerName?: string
  peerAvatarUrl?: string
  orderCorrelationId: string | null
  serviceLabel: string | null
}

interface MessageStoreState {
  byPeer: Record<string, DeliveryMessage[]>
  assetsBySession: Record<string, DeliveryAssetRecord[]>
  selectedSessionKey: string | null
  hydratedWalletGlobalMetaId: string | null
  append: (message: DeliveryMessage) => void
  appendOutgoingFollowUp: (input: {
    wallet: WalletIdentity
    session: FollowUpSessionInput
    content: string
    rawContent: string
    pinId: string
  }) => Promise<void>
  setSelectedSession: (sessionKey: string | null) => void
  hydrateFromDb: (walletGlobalMetaId: string) => Promise<void>
  listSessions: (selfGlobalMetaId: string) => DeliverySession[]
  messagesForSession: (sessionKey: string, selfGlobalMetaId: string) => DeliveryMessage[]
}

const STORAGE_KEY = 'bothub-delivery-messages'

function sortMessagesAsc(messages: DeliveryMessage[]): DeliveryMessage[] {
  return [...messages].sort((a, b) => {
    if (a.timestamp !== b.timestamp) return a.timestamp - b.timestamp
    return a.id.localeCompare(b.id)
  })
}

function hasText(value: string | undefined): boolean {
  return Boolean(value?.trim())
}

function isCiphertextLikeContent(content: string): boolean {
  const trimmed = content.trim()
  return trimmed.startsWith('U2FsdGVkX1') || (trimmed.length >= 32 && !/\s/.test(trimmed))
}

function hasMoreCompleteContent(
  existing: DeliveryMessage,
  incoming: DeliveryMessage,
): boolean {
  if (existing.content === incoming.content) return false
  const existingIsCiphertextFallback =
    existing.content === existing.rawContent &&
    (hasText(existing.decryptError) || isCiphertextLikeContent(existing.rawContent))
  return (
    existingIsCiphertextFallback &&
    incoming.content !== incoming.rawContent &&
    !incoming.decryptError
  )
}

function shouldReplaceMessage(
  existing: DeliveryMessage,
  incoming: DeliveryMessage,
): boolean {
  if (existing.id !== incoming.id) return false
  if (hasMoreCompleteContent(existing, incoming)) return true
  if (!hasText(existing.peerChatPubkey) && hasText(incoming.peerChatPubkey)) return true
  if (!hasText(existing.peerName) && hasText(incoming.peerName)) return true
  if (!hasText(existing.peerAvatarUrl) && hasText(incoming.peerAvatarUrl)) return true
  if (existing.decryptError && !incoming.decryptError && hasText(incoming.peerChatPubkey)) {
    return true
  }
  if (!hasText(existing.orderCorrelationId) && hasText(incoming.orderCorrelationId)) {
    return true
  }
  return false
}

function mergeReplacementMessage(
  existing: DeliveryMessage,
  incoming: DeliveryMessage,
): DeliveryMessage {
  return {
    ...existing,
    ...incoming,
    peerChatPubkey:
      incoming.peerChatPubkey?.trim() || existing.peerChatPubkey?.trim() || undefined,
    peerName: incoming.peerName?.trim() || existing.peerName?.trim() || undefined,
    peerAvatarUrl:
      incoming.peerAvatarUrl?.trim() || existing.peerAvatarUrl?.trim() || undefined,
    orderCorrelationId:
      incoming.orderCorrelationId?.trim() ||
      existing.orderCorrelationId?.trim() ||
      undefined,
    decryptError: incoming.decryptError,
    pinId: incoming.pinId ?? existing.pinId,
    txId: incoming.txId ?? existing.txId,
  }
}

function upsertMessage(
  byPeer: Record<string, DeliveryMessage[]>,
  message: DeliveryMessage,
): Record<string, DeliveryMessage[]> {
  const normalizedMessage = messageWithDerivedCorrelation(message)
  const peer = normalizedMessage.peerGlobalMetaId.trim()
  const existing = byPeer[peer] ?? []
  const existingIndex = existing.findIndex((row) => row.id === normalizedMessage.id)
  if (existingIndex >= 0) {
    const existingMessage = existing[existingIndex]
    if (existingMessage && shouldReplaceMessage(existingMessage, normalizedMessage)) {
      const next = [...existing]
      next[existingIndex] = mergeReplacementMessage(existingMessage, normalizedMessage)
      return {
        ...byPeer,
        [peer]: sortMessagesAsc(next),
      }
    }
    return byPeer
  }
  return {
    ...byPeer,
    [peer]: sortMessagesAsc([...existing, normalizedMessage]),
  }
}

function messageWithDerivedCorrelation(
  message: DeliveryMessage,
  knownCorrelationIds: ReadonlySet<string> = new Set(),
): DeliveryMessage {
  const existing = message.orderCorrelationId?.trim()
  if (existing) return { ...message, orderCorrelationId: existing }

  const protocolCorrelation = parseDeliveryProtocol(message.content).orderCorrelationId.trim()
  if (protocolCorrelation) {
    return { ...message, orderCorrelationId: protocolCorrelation }
  }

  const order = parseOrderMessage(message.content)
  const orderCorrelation = order ? getOrderCorrelationId(order).trim() : ''
  if (orderCorrelation) {
    return { ...message, orderCorrelationId: orderCorrelation }
  }

  const textMatch = findCorrelationInText(message.content, knownCorrelationIds).trim()
  if (textMatch) return { ...message, orderCorrelationId: textMatch }

  return message
}

function deliveryMessageFromRecord(
  record: DeliveryMessageRecord,
  selfGlobalMetaId: string,
  fallbackPeerProfile?: {
    chatPubkey?: string
    name?: string
    avatarUrl?: string
  },
): DeliveryMessage {
  const peer = record.peerGlobalMetaId.trim()
  const self = selfGlobalMetaId.trim()
  const outgoing = record.direction === 'outgoing'

  return {
    id: record.id,
    peerGlobalMetaId: peer,
    peerChatPubkey:
      record.peerChatPubkey?.trim() || fallbackPeerProfile?.chatPubkey,
    peerName: record.peerName?.trim() || fallbackPeerProfile?.name,
    peerAvatarUrl: record.peerAvatarUrl?.trim() || fallbackPeerProfile?.avatarUrl,
    fromGlobalMetaId: outgoing ? self : peer,
    toGlobalMetaId: outgoing ? peer : self,
    content: record.content,
    rawContent: record.rawContent,
    encryption: record.encryption,
    contentType: record.contentType,
    orderCorrelationId: record.orderCorrelationId,
    timestamp: record.timestamp,
    pinId: record.pinId,
    txId: record.txId,
    decryptError: record.decryptError,
  }
}

function deliveryMessageRecordFromMessage(input: {
  walletGlobalMetaId: string
  sessionId: string
  message: DeliveryMessage
  protocolTag?: string
}): DeliveryMessageRecord {
  const wallet = input.walletGlobalMetaId.trim()
  const direction = input.message.fromGlobalMetaId.trim() === wallet ? 'outgoing' : 'incoming'
  const decryptStatus = input.message.decryptError
    ? 'failed'
    : input.message.content === input.message.rawContent
      ? 'plain'
      : 'decrypted'

  return {
    id: input.message.id,
    walletGlobalMetaId: wallet,
    sessionId: input.sessionId,
    peerGlobalMetaId: input.message.peerGlobalMetaId.trim(),
    peerChatPubkey: input.message.peerChatPubkey?.trim() || undefined,
    peerName: input.message.peerName?.trim() || undefined,
    peerAvatarUrl: input.message.peerAvatarUrl?.trim() || undefined,
    direction,
    content: input.message.content,
    rawContent: input.message.rawContent,
    contentType: input.message.contentType,
    encryption: input.message.encryption,
    protocolTag: input.protocolTag,
    orderCorrelationId: input.message.orderCorrelationId?.trim() || undefined,
    pinId: input.message.pinId,
    txId: input.message.txId,
    timestamp: input.message.timestamp,
    decryptStatus,
    decryptError: input.message.decryptError,
  }
}

function assetRecordFromParsedAsset(input: {
  walletGlobalMetaId: string
  sessionId: string
  message: DeliveryMessage
  asset: ParsedDeliveryAsset
}): DeliveryAssetRecord {
  return {
    id: buildAssetId(input.sessionId, input.asset.uri),
    walletGlobalMetaId: input.walletGlobalMetaId,
    sessionId: input.sessionId,
    messageId: input.message.id,
    orderCorrelationId: input.message.orderCorrelationId?.trim() || undefined,
    uri: input.asset.uri,
    pinId: input.asset.pinId,
    filename: input.asset.filename,
    extension: input.asset.extension?.replace(/^\./, '') || undefined,
    kind: input.asset.kind,
    mimeType: input.asset.mimeType,
    previewUrl: input.asset.previewUrl,
    downloadUrl: input.asset.downloadUrl,
    fallbackUrl: input.asset.fallbackUrl,
    createdAt: input.message.timestamp,
  }
}

function protocolTagForMessage(message: DeliveryMessage): string | undefined {
  const protocol = parseDeliveryProtocol(message.content)
  if (protocol.kind !== 'plain') return protocol.kind
  return parseOrderMessage(message.content) ? 'order' : undefined
}

function deliveryMessagesFromRecords(
  records: DeliveryMessageRecord[],
  walletGlobalMetaId: string,
): DeliveryMessage[] {
  return records.map((record) => deliveryMessageFromRecord(record, walletGlobalMetaId))
}

export async function persistDeliveryMessage(input: {
  walletGlobalMetaId: string
  message: DeliveryMessage
}): Promise<void> {
  const walletGlobalMetaId = input.walletGlobalMetaId.trim()
  const peerGlobalMetaId = input.message.peerGlobalMetaId.trim()
  const messageId = input.message.id.trim()
  if (!walletGlobalMetaId || !peerGlobalMetaId || !messageId) {
    throw new Error('Delivery message is missing required identifiers')
  }

  const sessions = await getSessionsForWallet(walletGlobalMetaId)
  const peerSessions = sessions.filter(
    (session) => session.providerGlobalMetaId.trim() === peerGlobalMetaId,
  )
  const knownCorrelationIds = new Set(
    peerSessions
      .map((session) => session.orderCorrelationId?.trim() || '')
      .filter(Boolean),
  )
  const message = messageWithDerivedCorrelation(input.message, knownCorrelationIds)
  const orderCorrelationId = message.orderCorrelationId?.trim() || undefined
  const sessionId = buildSessionId({
    walletGlobalMetaId,
    providerGlobalMetaId: peerGlobalMetaId,
    orderCorrelationId,
  })
  const parsedAssets = deliveryAssetsFromMessage(message)
  const assetRecords = parsedAssets.map((asset) =>
    assetRecordFromParsedAsset({
      walletGlobalMetaId,
      sessionId,
      message,
      asset,
    }),
  )
  const messageRecord = deliveryMessageRecordFromMessage({
    walletGlobalMetaId,
    sessionId,
    message,
    protocolTag: protocolTagForMessage(message),
  })

  await persistDeliveryMessageRows({
    sessionId,
    message: messageRecord,
    assets: assetRecords,
    buildSession: ({ existingSession, messages, assets }) => {
      const derivedMessages = deliveryMessagesFromRecords(messages, walletGlobalMetaId)
      const lastMessage = derivedMessages[derivedMessages.length - 1] ?? message

      return {
        id: sessionId,
        walletGlobalMetaId,
        providerGlobalMetaId: peerGlobalMetaId,
        providerChatPubkey:
          message.peerChatPubkey?.trim() ||
          existingSession?.providerChatPubkey?.trim() ||
          undefined,
        providerName:
          message.peerName?.trim() ||
          existingSession?.providerName?.trim() ||
          undefined,
        providerAvatarUrl:
          message.peerAvatarUrl?.trim() ||
          existingSession?.providerAvatarUrl?.trim() ||
          undefined,
        orderCorrelationId,
        serviceId: existingSession?.serviceId,
        serviceLabel: existingSession?.serviceLabel,
        status: deriveSessionStatus(derivedMessages, walletGlobalMetaId),
        lastMessageId: lastMessage.id,
        lastActivityAt: lastMessage.timestamp,
        assetCount: assets.length,
        unreadCount: existingSession?.unreadCount ?? 0,
      }
    },
  })
}

export const useMessageStore = create<MessageStoreState>()(
  persist(
    (set, get) => ({
      byPeer: {},
      assetsBySession: {},
      selectedSessionKey: null,
      hydratedWalletGlobalMetaId: null,

      append: (message) => {
        set((state) => ({
          byPeer: upsertMessage(state.byPeer, message),
        }))
      },

      appendOutgoingFollowUp: async ({ wallet, session, content, rawContent, pinId }) => {
        const walletGlobalMetaId = wallet.globalMetaId.trim()
        const providerGlobalMetaId = session.peerGlobalMetaId.trim()
        if (!walletGlobalMetaId || !providerGlobalMetaId || !pinId.trim()) {
          throw new Error('Follow-up message is missing required identifiers')
        }

        const timestamp = Date.now()
        const sessionId = buildSessionId({
          walletGlobalMetaId,
          providerGlobalMetaId,
          orderCorrelationId: session.orderCorrelationId,
        })
        const message: DeliveryMessage = {
          id: pinId.trim(),
          peerGlobalMetaId: providerGlobalMetaId,
          peerChatPubkey: session.providerChatPubkey,
          peerName: session.peerName,
          peerAvatarUrl: session.peerAvatarUrl,
          fromGlobalMetaId: walletGlobalMetaId,
          toGlobalMetaId: providerGlobalMetaId,
          content,
          rawContent,
          encryption: 'ecdh',
          contentType: 'text/plain',
          orderCorrelationId: session.orderCorrelationId ?? undefined,
          timestamp,
          pinId: pinId.trim(),
        }

        await persistOutgoingFollowUp({
          session: {
            id: sessionId,
            walletGlobalMetaId,
            providerGlobalMetaId,
            providerChatPubkey: session.providerChatPubkey,
            providerName: session.peerName,
            providerAvatarUrl: session.peerAvatarUrl,
            orderCorrelationId: session.orderCorrelationId ?? undefined,
            serviceLabel: session.serviceLabel ?? undefined,
            status: 'active',
            lastMessageId: message.id,
            lastActivityAt: timestamp,
            assetCount: 0,
            unreadCount: 0,
          },
          message: {
            id: message.id,
            walletGlobalMetaId,
            sessionId,
            peerGlobalMetaId: providerGlobalMetaId,
            peerChatPubkey: session.providerChatPubkey,
            peerName: session.peerName,
            peerAvatarUrl: session.peerAvatarUrl,
            direction: 'outgoing',
            content,
            rawContent,
            contentType: 'text/plain',
            encryption: 'ecdh',
            orderCorrelationId: session.orderCorrelationId ?? undefined,
            pinId: message.pinId,
            timestamp,
            decryptStatus: 'plain',
          },
        })
        get().append(message)
      },

      setSelectedSession: (sessionKey) => {
        set({ selectedSessionKey: sessionKey?.trim() || null })
      },

      hydrateFromDb: async (walletGlobalMetaId) => {
        const wallet = walletGlobalMetaId.trim()
        if (!wallet) return

        const sessions = await getSessionsForWallet(wallet)
        const messageGroups = await Promise.all(
          sessions.map((session) => getMessagesForSession(session.id)),
        )
        const assetGroups = await Promise.all(
          sessions.map((session) => getAssetsForSession(session.id)),
        )
        const sessionProviderKeys = new Map(
          sessions.map((session) => [
            session.id,
            {
              chatPubkey: session.providerChatPubkey?.trim() || undefined,
              name: session.providerName?.trim() || undefined,
              avatarUrl: session.providerAvatarUrl?.trim() || undefined,
            },
          ]),
        )
        const messages = messageGroups.flat().map((record) =>
          deliveryMessageFromRecord(record, wallet, sessionProviderKeys.get(record.sessionId)),
        )

        set((state) => {
          const walletChanged = state.hydratedWalletGlobalMetaId !== wallet
          const baseByPeer = walletChanged ? {} : state.byPeer
          const assetsBySession = sessions.reduce<Record<string, DeliveryAssetRecord[]>>(
            (next, session, index) => {
              const assets = assetGroups[index] ?? []
              if (!assets.length) return next
              return { ...next, [session.id]: assets }
            },
            {},
          )
          return {
            byPeer: messages.reduce(
              (next, message) => upsertMessage(next, message),
              baseByPeer,
            ),
            assetsBySession,
            hydratedWalletGlobalMetaId: wallet,
            selectedSessionKey: walletChanged ? null : state.selectedSessionKey,
          }
        })
      },

      listSessions: (selfGlobalMetaId) =>
        buildGroupedSessionList(get().byPeer, selfGlobalMetaId),

      messagesForSession: (sessionKey, selfGlobalMetaId) =>
        resolveMessagesForSession(get().byPeer, sessionKey, selfGlobalMetaId),
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({
        byPeer: state.byPeer,
        hydratedWalletGlobalMetaId: state.hydratedWalletGlobalMetaId,
      }),
    },
  ),
)
