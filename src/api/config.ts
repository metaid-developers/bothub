/** meta-socket HTTP base URL (no trailing slash) */
export function getMetaSocketBaseUrl(): string {
  return import.meta.env.VITE_META_SOCKET_BASE_URL ?? ''
}

export function getNormalizedMetaSocketBaseUrl(): string {
  return getMetaSocketBaseUrl().replace(/\/+$/, '')
}

export const DEFAULT_METAFILE_ACCELERATE_CONTENT_BASE =
  'https://file.metaid.io/metafile-indexer/api/v1/files/accelerate/content'

export const DEFAULT_METAFILE_CONTENT_BASE =
  'https://file.metaid.io/metafile-indexer/api/v1/files/content'

function normalizeBaseUrl(value: string | undefined, fallback: string): string {
  const normalized = (value ?? '').trim().replace(/\/+$/, '')
  return normalized || fallback
}

export function getMetafileAccelerateContentBaseUrl(): string {
  return normalizeBaseUrl(
    import.meta.env.VITE_METAFILE_ACCELERATE_CONTENT_BASE,
    DEFAULT_METAFILE_ACCELERATE_CONTENT_BASE,
  )
}

export function getMetafileContentBaseUrl(): string {
  return normalizeBaseUrl(
    import.meta.env.VITE_METAFILE_CONTENT_BASE,
    DEFAULT_METAFILE_CONTENT_BASE,
  )
}

/** When true, aggregator client reads `src/mocks/aggregator/*.json` (no network). */
export function isAggregatorMockEnabled(): boolean {
  return import.meta.env.VITE_USE_AGGREGATOR_MOCK === 'true'
}

export const useAggregatorMock = isAggregatorMockEnabled

/** When true, skip real Socket.IO and accept injected mock envelopes only. */
export function useWsMock(): boolean {
  return import.meta.env.VITE_USE_WS_MOCK === 'true'
}
