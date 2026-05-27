/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_META_SOCKET_BASE_URL: string
  readonly VITE_USE_AGGREGATOR_MOCK?: string
  readonly VITE_USE_WS_MOCK?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
