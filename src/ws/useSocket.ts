import { create } from 'zustand'
import { mergePrivateChatItem } from '@/delivery/deliverySync'
import { useWsMock as isWsMockEnabled } from '@/api/config'
import {
  isPrivateChatForRecipient,
  isPrivateChatItem,
} from './privateChat'
import {
  connectSocket,
  type SocketConnectionStatus,
  type SocketController,
} from './socket'
import { WS_SERVER_NOTIFY_PRIVATE_CHAT, type SocketEnvelope } from './envelope'
import type { WalletIdentity } from '@/wallet/types'

const DEBUG_LOG_LIMIT = 40
type SocketIdentityInput = WalletIdentity | string

interface SocketState {
  status: SocketConnectionStatus
  connectedGlobalMetaId: string | null
  connectedIdentity: WalletIdentity | null
  lastError: string | null
  debugLog: string[]
  connect: (identity: SocketIdentityInput) => void
  disconnect: () => void
  pushDebug: (line: string) => void
  handleEnvelope: (envelope: SocketEnvelope, identity: SocketIdentityInput) => Promise<void>
  injectMockEnvelope: (envelope: SocketEnvelope, identity: SocketIdentityInput) => void
}

let activeController: SocketController | null = null

function pushDebugLine(lines: string[], line: string): string[] {
  const next = [...lines, line]
  if (next.length > DEBUG_LOG_LIMIT) return next.slice(-DEBUG_LOG_LIMIT)
  return next
}

function identityFromInput(input: SocketIdentityInput): WalletIdentity {
  if (typeof input !== 'string') return input
  return {
    globalMetaId: input,
    mvcAddress: '',
    btcAddress: '',
    dogeAddress: '',
  }
}

function isPrivateChatForIdentity(
  envelope: SocketEnvelope,
  identity: WalletIdentity,
): boolean {
  if (!isPrivateChatItem(envelope.D)) return false
  return (
    isPrivateChatForRecipient(envelope.D, identity.globalMetaId) ||
    (!!identity.mvcAddress && isPrivateChatForRecipient(envelope.D, identity.mvcAddress))
  )
}

export const useSocket = create<SocketState>()((set, get) => ({
  status: 'disconnected',
  connectedGlobalMetaId: null,
  connectedIdentity: null,
  lastError: null,
  debugLog: [],

  pushDebug: (line) => {
    set((state) => ({ debugLog: pushDebugLine(state.debugLog, line) }))
  },

  handleEnvelope: async (envelope, identityInput) => {
    if (envelope.M !== WS_SERVER_NOTIFY_PRIVATE_CHAT) return
    if (!isPrivateChatItem(envelope.D)) {
      get().pushDebug('[ws] dropped private chat: invalid payload')
      return
    }
    const identity = identityFromInput(identityInput)
    const selfGlobalMetaId = identity.globalMetaId.trim()
    if (!selfGlobalMetaId || !isPrivateChatForIdentity(envelope, identity)) return

    let result: Awaited<ReturnType<typeof mergePrivateChatItem>>
    try {
      result = await mergePrivateChatItem({
        item: envelope.D,
        selfGlobalMetaId,
        walletIdentity: identity,
        pushDebug: get().pushDebug,
      })
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error)
      get().pushDebug(`[delivery] private chat was not merged: ${detail}`)
      return
    }
    if (!result.persisted) {
      const detail =
        result.persistenceError instanceof Error
          ? result.persistenceError.message
          : String(result.persistenceError)
      get().pushDebug(`[cache] delivery message was not saved: ${detail}`)
    }
  },

  injectMockEnvelope: (envelope, identityInput) => {
    if (!import.meta.env.DEV && !isWsMockEnabled()) return
    void get().handleEnvelope(envelope, identityInput)
  },

  connect: (identityInput) => {
    const identity = identityFromInput(identityInput)
    const gmid = identity.globalMetaId.trim()
    if (!gmid) return

    if (isWsMockEnabled()) {
      activeController?.disconnect()
      activeController = null
      set({
        status: 'connected',
        connectedGlobalMetaId: gmid,
        connectedIdentity: identity,
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
        void get().handleEnvelope(envelope, identity)
      },
      onStatus: (status) => set({ status }),
      onError: (message) => set({ lastError: message }),
    })

    set({ connectedGlobalMetaId: gmid, connectedIdentity: identity, lastError: null })
  },

  disconnect: () => {
    activeController?.disconnect()
    activeController = null
    set({
      status: 'disconnected',
      connectedGlobalMetaId: null,
      connectedIdentity: null,
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
    const identity = useSocket.getState().connectedIdentity
    if (!identity) return
    useSocket.getState().injectMockEnvelope(envelope, identity)
  }
}
