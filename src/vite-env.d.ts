/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_METASO_P2P_BASE_URL: string
  readonly VITE_METAFILE_ACCELERATE_CONTENT_BASE?: string
  readonly VITE_METAFILE_CONTENT_BASE?: string
  readonly VITE_USE_AGGREGATOR_MOCK?: string
  readonly VITE_USE_WS_MOCK?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
