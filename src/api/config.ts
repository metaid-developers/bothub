/** meta-socket HTTP base URL (no trailing slash) */
export function getMetaSocketBaseUrl(): string {
  return import.meta.env.VITE_META_SOCKET_BASE_URL ?? ''
}

/** When true, aggregator client reads `src/mocks/aggregator/*.json` (no network). */
export function useAggregatorMock(): boolean {
  return import.meta.env.VITE_USE_AGGREGATOR_MOCK === 'true'
}
