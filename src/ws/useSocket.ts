import { create } from 'zustand'
import { decryptIncoming } from '@/delivery/decrypt'
import { useMessageStore, type DeliveryMessage } from '@/delivery/messageStore'
import { useWsMock as isWsMockEnabled } from '@/api/config'
import {
  isPrivateChatForRecipient,
  isPrivateChatItem,
  messageIdFromPrivateChat,
  peerChatPublicKeyFromPrivateChat,
  peerGlobalMetaIdFromPrivateChat,
  type PrivateChatItem,
} from './privateChat'
import {
  connectSocket,
  type SocketConnectionStatus,
  type SocketController,
} from './socket'
import { WS_SERVER_NOTIFY_PRIVATE_CHAT, type SocketEnvelope } from './envelope'

const DEBUG_LOG_LIMIT = 40

interface SocketState {
  status: SocketConnectionStatus
  connectedGlobalMetaId: string | null
  lastError: string | null
  debugLog: string[]
  connect: (globalMetaId: string) => void
  disconnect: () => void
  pushDebug: (line: string) => void
  handleEnvelope: (envelope: SocketEnvelope, selfGlobalMetaId: string) => Promise<void>
  injectMockEnvelope: (envelope: SocketEnvelope, selfGlobalMetaId: string) => void
}

let activeController: SocketController | null = null

function pushDebugLine(lines: string[], line: string): string[] {
  const next = [...lines, line]
  if (next.length > DEBUG_LOG_LIMIT) return next.slice(-DEBUG_LOG_LIMIT)
  return next
}

async function privateChatToDeliveryMessage(
  item: PrivateChatItem,
  selfGlobalMetaId: string,
  pushDebug: (line: string) => void,
): Promise<DeliveryMessage> {
  const peerGlobalMetaId = peerGlobalMetaIdFromPrivateChat(item, selfGlobalMetaId)
  const rawContent = item.content
  const peerChatPubKey = peerChatPublicKeyFromPrivateChat(item, selfGlobalMetaId)

  const { plaintext, error } = await decryptIncoming({
    content: rawContent,
    encryption: item.encryption,
    peerChatPubKey,
  })

  if (error) {
    pushDebug(`[decrypt] ${peerGlobalMetaId.slice(0, 8)}…: ${error}`)
  }

  return {
    id: messageIdFromPrivateChat(item),
    peerGlobalMetaId,
    peerChatPubkey: peerChatPubKey,
    fromGlobalMetaId: item.fromGlobalMetaId.trim(),
    toGlobalMetaId: item.toGlobalMetaId.trim(),
    content: plaintext || rawContent,
    rawContent,
    encryption: item.encryption ?? '',
    contentType: item.contentType ?? 'text/plain',
    timestamp: item.timestamp,
    pinId: item.pinId,
    txId: item.txId,
    decryptError: error,
  }
}

export const useSocket = create<SocketState>()((set, get) => ({
  status: 'disconnected',
  connectedGlobalMetaId: null,
  lastError: null,
  debugLog: [],

  pushDebug: (line) => {
    set((state) => ({ debugLog: pushDebugLine(state.debugLog, line) }))
  },

  handleEnvelope: async (envelope, selfGlobalMetaId) => {
    if (envelope.M !== WS_SERVER_NOTIFY_PRIVATE_CHAT) return
    if (!isPrivateChatItem(envelope.D)) {
      get().pushDebug('[ws] dropped private chat: invalid payload')
      return
    }
    if (!isPrivateChatForRecipient(envelope.D, selfGlobalMetaId)) return

    const message = await privateChatToDeliveryMessage(
      envelope.D,
      selfGlobalMetaId,
      get().pushDebug,
    )
    useMessageStore.getState().append(message)
  },

  injectMockEnvelope: (envelope, selfGlobalMetaId) => {
    if (!import.meta.env.DEV && !isWsMockEnabled()) return
    void get().handleEnvelope(envelope, selfGlobalMetaId)
  },

  connect: (globalMetaId) => {
    const gmid = globalMetaId.trim()
    if (!gmid) return

    if (isWsMockEnabled()) {
      activeController?.disconnect()
      activeController = null
      set({
        status: 'connected',
        connectedGlobalMetaId: gmid,
        lastError: null,
      })
      get().pushDebug('[ws] mock mode — no socket connection')
      return
    }

    if (get().connectedGlobalMetaId === gmid && get().status === 'connected') {
      return
    }

    activeController?.disconnect()
    activeController = connectSocket({
      globalMetaId: gmid,
      onEnvelope: (envelope) => {
        void get().handleEnvelope(envelope, gmid)
      },
      onStatus: (status) => set({ status }),
      onError: (message) => set({ lastError: message }),
    })

    set({ connectedGlobalMetaId: gmid, lastError: null })
  },

  disconnect: () => {
    activeController?.disconnect()
    activeController = null
    set({
      status: 'disconnected',
      connectedGlobalMetaId: null,
      lastError: null,
    })
  },
}))

declare global {
  interface Window {
    __bothubInjectWsMessage?: (envelope: SocketEnvelope) => void
  }
}

if (import.meta.env.DEV && typeof window !== 'undefined') {
  window.__bothubInjectWsMessage = (envelope) => {
    const gmid = useSocket.getState().connectedGlobalMetaId
    if (!gmid) return
    useSocket.getState().injectMockEnvelope(envelope, gmid)
  }
}
