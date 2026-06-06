import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  server: {
    host: '127.0.0.1',
    port: 5176,
    strictPort: true,
    proxy: {
      '/metaso-p2p': {
        target: 'http://127.0.0.1:18091',
        changeOrigin: true,
        ws: true,
        rewrite: (path) => path.replace(/^\/metaso-p2p/, ''),
      },
    },
  },
})
