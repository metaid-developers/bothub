import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

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
  peerGlobalMetaId: string
  lastMessage: DeliveryMessage
  messageCount: number
}

interface MessageStoreState {
  byPeer: Record<string, DeliveryMessage[]>
  selectedPeerGlobalMetaId: string | null
  append: (message: DeliveryMessage) => void
  setSelectedPeer: (peerGlobalMetaId: string | null) => void
  listSessions: () => DeliverySession[]
  messagesForPeer: (peerGlobalMetaId: string) => DeliveryMessage[]
}

const STORAGE_KEY = 'bothub-delivery-messages'

function sortMessagesAsc(messages: DeliveryMessage[]): DeliveryMessage[] {
  return [...messages].sort((a, b) => {
    if (a.timestamp !== b.timestamp) return a.timestamp - b.timestamp
    return a.id.localeCompare(b.id)
  })
}

export function buildSessionList(
  byPeer: Record<string, DeliveryMessage[]>,
): DeliverySession[] {
  return Object.entries(byPeer)
    .map(([peerGlobalMetaId, messages]) => {
      const sorted = sortMessagesAsc(messages)
      const lastMessage = sorted[sorted.length - 1]
      if (!lastMessage) return null
      return {
        peerGlobalMetaId,
        lastMessage,
        messageCount: sorted.length,
      }
    })
    .filter((row): row is DeliverySession => row != null)
    .sort(
      (a, b) =>
        b.lastMessage.timestamp - a.lastMessage.timestamp ||
        b.lastMessage.id.localeCompare(a.lastMessage.id),
    )
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
      selectedPeerGlobalMetaId: null,

      append: (message) => {
        set((state) => ({
          byPeer: upsertMessage(state.byPeer, message),
        }))
      },

      setSelectedPeer: (peerGlobalMetaId) => {
        set({ selectedPeerGlobalMetaId: peerGlobalMetaId })
      },

      listSessions: () => buildSessionList(get().byPeer),

      messagesForPeer: (peerGlobalMetaId) => {
        const peer = peerGlobalMetaId.trim()
        return sortMessagesAsc(get().byPeer[peer] ?? [])
      },
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({ byPeer: state.byPeer }),
    },
  ),
)
