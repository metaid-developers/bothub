// @vitest-environment node

import viteConfig from '../../vite.config'

describe('vite dev proxy config', () => {
  it('proxies meta-socket websocket upgrades while preserving path rewrite', () => {
    const proxy = viteConfig.server?.proxy
    expect(proxy).toBeDefined()

    const metaSocketProxy = proxy?.['/meta-socket']
    expect(metaSocketProxy).toMatchObject({
      target: 'http://127.0.0.1:18091',
      changeOrigin: true,
      ws: true,
    })

    expect(typeof metaSocketProxy).toBe('object')
    if (typeof metaSocketProxy !== 'object' || metaSocketProxy === null) {
      throw new Error('Expected /meta-socket proxy to be an object')
    }

    expect(metaSocketProxy.rewrite?.('/meta-socket/socket/socket.io')).toBe(
      '/socket/socket.io',
    )
  })
})
