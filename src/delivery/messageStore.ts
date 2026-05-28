import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import {
  getMessagesForSession,
  getSessionsForWallet,
  persistOutgoingFollowUp,
} from '@/delivery/db'
import type { DeliveryMessageRecord } from '@/delivery/domain'
import { buildSessionId } from '@/delivery/domain'
import {
  buildGroupedSessionList,
  messagesForSession as resolveMessagesForSession,
} from '@/delivery/sessionGrouping'
import type { WalletIdentity } from '@/wallet/types'

export interface DeliveryMessage {
  id: string
  peerGlobalMetaId: string
  peerChatPubkey?: string
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
  orderCorrelationId: string | null
  serviceLabel: string | null
  lastMessage: DeliveryMessage
  messageCount: number
}

interface MessageStoreState {
  byPeer: Record<string, DeliveryMessage[]>
  selectedSessionKey: string | null
  hydratedWalletGlobalMetaId: string | null
  append: (message: DeliveryMessage) => void
  appendOutgoingFollowUp: (input: {
    wallet: WalletIdentity
    session: DeliverySession
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

function upsertMessage(
  byPeer: Record<string, DeliveryMessage[]>,
  message: DeliveryMessage,
): Record<string, DeliveryMessage[]> {
  const peer = message.peerGlobalMetaId.trim()
  const existing = byPeer[peer] ?? []
  if (existing.some((row) => row.id === message.id)) {
    return byPeer
  }
  return {
    ...byPeer,
    [peer]: sortMessagesAsc([...existing, message]),
  }
}

function deliveryMessageFromRecord(
  record: DeliveryMessageRecord,
  selfGlobalMetaId: string,
  fallbackPeerChatPubkey?: string,
): DeliveryMessage {
  const peer = record.peerGlobalMetaId.trim()
  const self = selfGlobalMetaId.trim()
  const outgoing = record.direction === 'outgoing'

  return {
    id: record.id,
    peerGlobalMetaId: peer,
    peerChatPubkey: record.peerChatPubkey?.trim() || fallbackPeerChatPubkey,
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

export const useMessageStore = create<MessageStoreState>()(
  persist(
    (set, get) => ({
      byPeer: {},
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
        const sessionProviderKeys = new Map(
          sessions.map((session) => [
            session.id,
            session.providerChatPubkey?.trim() || undefined,
          ]),
        )
        const messages = messageGroups.flat().map((record) =>
          deliveryMessageFromRecord(record, wallet, sessionProviderKeys.get(record.sessionId)),
        )

        set((state) => {
          const walletChanged = state.hydratedWalletGlobalMetaId !== wallet
          const baseByPeer = walletChanged ? {} : state.byPeer
          return {
            byPeer: messages.reduce(
              (next, message) => upsertMessage(next, message),
              baseByPeer,
            ),
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
