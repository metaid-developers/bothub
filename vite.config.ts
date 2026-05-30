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
    port: 5176,
    proxy: {
      '/meta-socket': {
        target: 'http://127.0.0.1:18091',
        changeOrigin: true,
        ws: true,
        rewrite: (path) => path.replace(/^\/meta-socket/, ''),
      },
    },
  },
})
