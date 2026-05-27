import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
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
  append: (message: DeliveryMessage) => void
  setSelectedSession: (sessionKey: string | null) => void
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

export const useMessageStore = create<MessageStoreState>()(
  persist(
    (set, get) => ({
      byPeer: {},
      selectedSessionKey: null,

      append: (message) => {
        set((state) => ({
          byPeer: upsertMessage(state.byPeer, message),
        }))
      },

      setSelectedSession: (sessionKey) => {
        set({ selectedSessionKey: sessionKey?.trim() || null })
      },

      listSessions: (selfGlobalMetaId) =>
        buildGroupedSessionList(get().byPeer, selfGlobalMetaId),

      messagesForSession: (sessionKey, selfGlobalMetaId) =>
        resolveMessagesForSession(get().byPeer, sessionKey, selfGlobalMetaId),
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({ byPeer: state.byPeer }),
    },
  ),
)
