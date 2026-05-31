import { create } from 'zustand'

export type DeliverySyncUiStatus =
  | 'idle'
  | 'hydrating'
  | 'syncing'
  | 'ready'
  | 'partial'
  | 'error'

interface DeliverySyncStatusState {
  walletGlobalMetaId: string | null
  status: DeliverySyncUiStatus
  failedPeerCount: number
  errorMessage: string | null
  lastSyncedAt: number | null
  startHydrating: (walletGlobalMetaId: string) => void
  startSyncing: () => void
  finishSync: (input: { failedPeerCount: number }) => void
  failSync: (error: unknown) => void
  reset: () => void
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error || 'Delivery sync failed')
}

export const useDeliverySyncStatusStore = create<DeliverySyncStatusState>()((set) => ({
  walletGlobalMetaId: null,
  status: 'idle',
  failedPeerCount: 0,
  errorMessage: null,
  lastSyncedAt: null,
  startHydrating: (walletGlobalMetaId) =>
    set({
      walletGlobalMetaId: walletGlobalMetaId.trim() || null,
      status: 'hydrating',
      failedPeerCount: 0,
      errorMessage: null,
    }),
  startSyncing: () => set({ status: 'syncing', errorMessage: null }),
  finishSync: ({ failedPeerCount }) =>
    set({
      status: failedPeerCount > 0 ? 'partial' : 'ready',
      failedPeerCount,
      errorMessage: null,
      lastSyncedAt: Date.now(),
    }),
  failSync: (error) =>
    set({
      status: 'error',
      errorMessage: errorMessage(error),
    }),
  reset: () =>
    set({
      walletGlobalMetaId: null,
      status: 'idle',
      failedPeerCount: 0,
      errorMessage: null,
      lastSyncedAt: null,
    }),
}))
