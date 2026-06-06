// @vitest-environment node

import viteConfig from '../../vite.config'

describe('vite dev proxy config', () => {
  it('proxies metaso-p2p websocket upgrades while preserving path rewrite', () => {
    const proxy = viteConfig.server?.proxy
    expect(proxy).toBeDefined()

    const metasoP2PProxy = proxy?.['/metaso-p2p']
    expect(metasoP2PProxy).toMatchObject({
      target: 'http://127.0.0.1:18091',
      changeOrigin: true,
      ws: true,
    })

    expect(typeof metasoP2PProxy).toBe('object')
    if (typeof metasoP2PProxy !== 'object' || metasoP2PProxy === null) {
      throw new Error('Expected /metaso-p2p proxy to be an object')
    }

    expect(metasoP2PProxy.rewrite?.('/metaso-p2p/socket/socket.io')).toBe(
      '/socket/socket.io',
    )
  })
})
