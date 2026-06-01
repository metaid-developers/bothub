import { afterEach, describe, expect, it, vi } from 'vitest'

const ioMock = vi.fn()

vi.mock('socket.io-client', () => ({
  io: ioMock,
}))

async function loadSocketModule() {
  return import('@/ws/socket')
}

function stubSocket() {
  return {
    on: vi.fn(),
    emit: vi.fn(),
    removeAllListeners: vi.fn(),
    disconnect: vi.fn(),
  }
}

describe('socket client', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
    ioMock.mockReset()
  })

  it('connectSocket puts relative proxy base in path instead of namespace URI', async () => {
    const socket = stubSocket()
    ioMock.mockReturnValue(socket)

    const { connectSocket } = await loadSocketModule()
    connectSocket({
      baseUrl: '/meta-socket/',
      globalMetaId: ' idq1abc ',
      onEnvelope: vi.fn(),
    })

    expect(ioMock).toHaveBeenCalledOnce()
    expect(ioMock).toHaveBeenCalledWith({
      path: '/meta-socket/socket/socket.io',
      query: { metaid: 'idq1abc', type: 'app' },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1_000,
      reconnectionDelayMax: 30_000,
    })
  })

  it('connectSocket keeps absolute host URL with meta-socket Socket.IO path', async () => {
    const socket = stubSocket()
    ioMock.mockReturnValue(socket)

    const { connectSocket } = await loadSocketModule()
    connectSocket({
      baseUrl: 'https://meta-socket.example.com/',
      globalMetaId: 'idq1abc',
      onEnvelope: vi.fn(),
    })

    expect(ioMock).toHaveBeenCalledOnce()
    expect(ioMock).toHaveBeenCalledWith('https://meta-socket.example.com', {
      path: '/socket/socket.io',
      query: { metaid: 'idq1abc', type: 'app' },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1_000,
      reconnectionDelayMax: 30_000,
    })
  })

  it('connectSocket puts absolute base path in Socket.IO path instead of namespace URI', async () => {
    const socket = stubSocket()
    ioMock.mockReturnValue(socket)

    const { connectSocket } = await loadSocketModule()
    connectSocket({
      baseUrl: 'https://host.example/meta-socket/',
      globalMetaId: 'idq1abc',
      onEnvelope: vi.fn(),
    })

    expect(ioMock).toHaveBeenCalledOnce()
    expect(ioMock).toHaveBeenCalledWith('https://host.example', {
      path: '/meta-socket/socket/socket.io',
      query: { metaid: 'idq1abc', type: 'app' },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1_000,
      reconnectionDelayMax: 30_000,
    })
  })
})
