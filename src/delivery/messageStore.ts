import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { getMessagesForSession, getSessionsForWallet } from '@/delivery/db'
import type { DeliveryMessageRecord } from '@/delivery/domain'
import {
  buildGroupedSessionList,
  messagesForSession as resolveMessagesForSession,
} from '@/delivery/sessionGrouping'

export interface DeliveryMessage {
  id: string
  peerGlobalMetaId: string
  fromGlobalMetaId: string
  toGlobalMetaId: string
  /** Display text (decrypted when possible). */
  content: string
  /** Original on-chain / WS ciphertext (never dropped). */
  rawContent: string
  encryption: string
  contentType: string
  timestamp: number
  pinId?: string
  txId?: string
  decryptError?: string
}

export interface DeliverySession {
  sessionKey: string
  peerGlobalMetaId: string
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
): DeliveryMessage {
  const peer = record.peerGlobalMetaId.trim()
  const self = selfGlobalMetaId.trim()
  const outgoing = record.direction === 'outgoing'

  return {
    id: record.id,
    peerGlobalMetaId: peer,
    fromGlobalMetaId: outgoing ? self : peer,
    toGlobalMetaId: outgoing ? peer : self,
    content: record.content,
    rawContent: record.rawContent,
    encryption: record.encryption,
    contentType: record.contentType,
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
        const messages = messageGroups
          .flat()
          .map((record) => deliveryMessageFromRecord(record, wallet))

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
