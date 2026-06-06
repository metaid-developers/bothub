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
      baseUrl: '/metaso-p2p/',
      globalMetaId: ' idq1abc ',
      onEnvelope: vi.fn(),
    })

    expect(ioMock).toHaveBeenCalledOnce()
    expect(ioMock).toHaveBeenCalledWith({
      path: '/metaso-p2p/socket/socket.io',
      query: { metaid: 'idq1abc', type: 'app' },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1_000,
      reconnectionDelayMax: 30_000,
    })
  })

  it('connectSocket keeps absolute host URL with metaso-p2p Socket.IO path', async () => {
    const socket = stubSocket()
    ioMock.mockReturnValue(socket)

    const { connectSocket } = await loadSocketModule()
    connectSocket({
      baseUrl: 'https://metaso-p2p.example.com/',
      globalMetaId: 'idq1abc',
      onEnvelope: vi.fn(),
    })

    expect(ioMock).toHaveBeenCalledOnce()
    expect(ioMock).toHaveBeenCalledWith('https://metaso-p2p.example.com', {
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
      baseUrl: 'https://host.example/metaso-p2p/',
      globalMetaId: 'idq1abc',
      onEnvelope: vi.fn(),
    })

    expect(ioMock).toHaveBeenCalledOnce()
    expect(ioMock).toHaveBeenCalledWith('https://host.example', {
      path: '/metaso-p2p/socket/socket.io',
      query: { metaid: 'idq1abc', type: 'app' },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1_000,
      reconnectionDelayMax: 30_000,
    })
  })
})
