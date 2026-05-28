import { io, type Socket } from 'socket.io-client'
import { getNormalizedMetaSocketBaseUrl } from '@/api/config'
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
const SOCKET_PATH = '/socket/socket.io'

interface SocketEndpoint {
  uri?: string
  path: string
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, '')
}

function isRelativeBaseUrl(baseUrl: string): boolean {
  return baseUrl.startsWith('/')
}

function buildSocketEndpoint(baseUrl: string): SocketEndpoint {
  if (isRelativeBaseUrl(baseUrl)) {
    return { path: `${baseUrl}${SOCKET_PATH}` }
  }

  const url = new URL(baseUrl)
  return {
    uri: url.origin,
    path: `${normalizeBaseUrl(url.pathname)}${SOCKET_PATH}`,
  }
}

export function connectSocket(options: ConnectSocketOptions): SocketController {
  const baseUrl = options.baseUrl
    ? normalizeBaseUrl(options.baseUrl)
    : getNormalizedMetaSocketBaseUrl()
  const globalMetaId = options.globalMetaId.trim()

  if (!baseUrl || !globalMetaId) {
    options.onStatus?.('error')
    options.onError?.('meta-socket base URL and globalMetaId are required')
    return { disconnect: () => undefined }
  }

  options.onStatus?.('connecting')

  const socketEndpoint = buildSocketEndpoint(baseUrl)
  const socketOptions = {
    path: socketEndpoint.path,
    query: { metaid: globalMetaId, type: 'app' },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 1_000,
    reconnectionDelayMax: RECONNECTION_DELAY_MAX_MS,
  }

  const socket: Socket = socketEndpoint.uri
    ? io(socketEndpoint.uri, socketOptions)
    : io(socketOptions)

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
