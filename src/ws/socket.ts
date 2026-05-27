import { io, type Socket } from 'socket.io-client'
import { getMetaSocketBaseUrl } from '@/api/config'
import { parseSocketEnvelope, type SocketEnvelope } from './envelope'

export type SocketConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error'

export interface SocketController {
  disconnect: () => void
}

export interface ConnectSocketOptions {
  globalMetaId: string
  baseUrl?: string
  onEnvelope: (envelope: SocketEnvelope) => void
  onStatus?: (status: SocketConnectionStatus) => void
  onError?: (message: string) => void
}

const HEARTBEAT_MS = 30_000
const RECONNECTION_DELAY_MAX_MS = 30_000

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, '')
}

export function buildSocketUrl(baseUrl: string, globalMetaId: string): string {
  const root = normalizeBaseUrl(baseUrl)
  const params = new URLSearchParams({
    metaid: globalMetaId.trim(),
    type: 'app',
  })
  return `${root}/socket/socket.io?${params.toString()}`
}

export function connectSocket(options: ConnectSocketOptions): SocketController {
  const baseUrl = normalizeBaseUrl(options.baseUrl ?? getMetaSocketBaseUrl())
  const globalMetaId = options.globalMetaId.trim()

  if (!baseUrl || !globalMetaId) {
    options.onStatus?.('error')
    options.onError?.('meta-socket base URL and globalMetaId are required')
    return { disconnect: () => undefined }
  }

  options.onStatus?.('connecting')

  const socket: Socket = io(`${baseUrl}/socket/socket.io`, {
    query: { metaid: globalMetaId, type: 'app' },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 1_000,
    reconnectionDelayMax: RECONNECTION_DELAY_MAX_MS,
  })

  let heartbeatTimer: ReturnType<typeof setInterval> | undefined

  const stopHeartbeat = () => {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer)
      heartbeatTimer = undefined
    }
  }

  const startHeartbeat = () => {
    stopHeartbeat()
    socket.emit('ping')
    heartbeatTimer = setInterval(() => {
      socket.emit('ping')
    }, HEARTBEAT_MS)
  }

  socket.on('connect', () => {
    options.onStatus?.('connected')
    startHeartbeat()
  })

  socket.on('disconnect', () => {
    stopHeartbeat()
    options.onStatus?.('disconnected')
  })

  socket.on('connect_error', (err: Error) => {
    options.onStatus?.('error')
    options.onError?.(err.message)
  })

  socket.on('heartbeat_ack', () => {
    // server ack for ping — no-op
  })

  socket.on('message', (raw: unknown) => {
    const envelope = parseSocketEnvelope(raw)
    if (envelope) options.onEnvelope(envelope)
  })

  return {
    disconnect: () => {
      stopHeartbeat()
      socket.removeAllListeners()
      socket.disconnect()
      options.onStatus?.('disconnected')
    },
  }
}
