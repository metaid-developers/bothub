import { create } from 'zustand'
import { mergePrivateChatItem } from '@/delivery/deliverySync'
import { useWsMock as isWsMockEnabled } from '@/api/config'
import {
  isPrivateChatForRecipient,
  normalizePrivateChatItem,
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

let activeControllers: SocketController[] = []
let activeConnectionStatuses = new Map<string, SocketConnectionStatus>()

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

function socketMetaIdsForIdentity(identity: WalletIdentity): string[] {
  return Array.from(
    new Set(
      [
        identity.globalMetaId,
        identity.metaid,
        identity.mvcAddress,
        identity.btcAddress,
        identity.dogeAddress,
      ]
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  )
}

function socketConnectionKey(identity: WalletIdentity): string {
  return socketMetaIdsForIdentity(identity).join('|')
}

function disconnectActiveControllers(): void {
  for (const controller of activeControllers) {
    controller.disconnect()
  }
  activeControllers = []
  activeConnectionStatuses = new Map()
}

function aggregateSocketStatus(): SocketConnectionStatus {
  const statuses = Array.from(activeConnectionStatuses.values())
  if (statuses.some((status) => status === 'error')) return 'error'
  if (statuses.length > 0 && statuses.every((status) => status === 'connected')) {
    return 'connected'
  }
  if (statuses.some((status) => status === 'connecting')) return 'connecting'
  if (statuses.some((status) => status === 'connected')) return 'connected'
  return 'disconnected'
}

function isPrivateChatForIdentity(
  envelope: SocketEnvelope,
  identity: WalletIdentity,
): boolean {
  const item = normalizePrivateChatItem(envelope.D)
  if (!item) return false
  return socketMetaIdsForIdentity(identity).some((metaId) =>
    isPrivateChatForRecipient(item, metaId),
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
    const item = normalizePrivateChatItem(envelope.D)
    if (!item) {
      get().pushDebug('[ws] dropped private chat: invalid payload')
      return
    }
    const identity = identityFromInput(identityInput)
    const selfGlobalMetaId = identity.globalMetaId.trim()
    if (!selfGlobalMetaId || !isPrivateChatForIdentity(envelope, identity)) return

    let result: Awaited<ReturnType<typeof mergePrivateChatItem>>
    try {
      result = await mergePrivateChatItem({
        item,
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
    const socketMetaIds = socketMetaIdsForIdentity(identity)
    const connectionKey = socketConnectionKey(identity)
    if (!gmid) return

    if (isWsMockEnabled()) {
      disconnectActiveControllers()
      set({
        status: 'connected',
        connectedGlobalMetaId: connectionKey,
        connectedIdentity: identity,
        lastError: null,
      })
      get().pushDebug('[ws] mock mode — no socket connection')
      return
    }

    if (get().connectedGlobalMetaId === connectionKey && get().status === 'connected') {
      return
    }

    disconnectActiveControllers()
    activeConnectionStatuses = new Map(
      socketMetaIds.map((metaId) => [metaId, 'connecting' as SocketConnectionStatus]),
    )
    activeControllers = socketMetaIds.map((metaId) =>
      connectSocket({
        globalMetaId: metaId,
        onEnvelope: (envelope) => {
          void get().handleEnvelope(envelope, identity)
        },
        onStatus: (status) => {
          activeConnectionStatuses.set(metaId, status)
          set({ status: aggregateSocketStatus() })
        },
        onError: (message) => set({ lastError: message }),
      }),
    )

    set({ connectedGlobalMetaId: connectionKey, connectedIdentity: identity, lastError: null })
  },

  disconnect: () => {
    disconnectActiveControllers()
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
