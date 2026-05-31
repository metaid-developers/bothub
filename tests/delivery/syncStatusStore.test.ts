import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useDeliverySyncStatusStore } from '@/delivery/syncStatusStore'

describe('delivery sync status store', () => {
  beforeEach(() => {
    useDeliverySyncStatusStore.getState().reset()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('tracks hydration, syncing, ready, and last synced timestamp', () => {
    vi.useFakeTimers()
    vi.setSystemTime(1000)
    useDeliverySyncStatusStore.getState().startHydrating('idqbuyer')
    expect(useDeliverySyncStatusStore.getState()).toMatchObject({
      walletGlobalMetaId: 'idqbuyer',
      status: 'hydrating',
      failedPeerCount: 0,
    })

    useDeliverySyncStatusStore.getState().startSyncing()
    expect(useDeliverySyncStatusStore.getState().status).toBe('syncing')

    useDeliverySyncStatusStore.getState().finishSync({ failedPeerCount: 0 })
    expect(useDeliverySyncStatusStore.getState()).toMatchObject({
      status: 'ready',
      lastSyncedAt: 1000,
      failedPeerCount: 0,
    })
  })

  it('keeps cached delivery usable when history sync is partial', () => {
    useDeliverySyncStatusStore.getState().startHydrating('idqbuyer')
    useDeliverySyncStatusStore.getState().startSyncing()
    useDeliverySyncStatusStore.getState().finishSync({ failedPeerCount: 2 })

    expect(useDeliverySyncStatusStore.getState()).toMatchObject({
      status: 'partial',
      failedPeerCount: 2,
    })
  })

  it('records unrecoverable sync errors without clearing the wallet id', () => {
    useDeliverySyncStatusStore.getState().startHydrating('idqbuyer')
    useDeliverySyncStatusStore.getState().failSync(new Error('network down'))

    expect(useDeliverySyncStatusStore.getState()).toMatchObject({
      walletGlobalMetaId: 'idqbuyer',
      status: 'error',
      errorMessage: 'network down',
    })
  })

  it('resets to idle', () => {
    useDeliverySyncStatusStore.getState().startHydrating('idqbuyer')
    useDeliverySyncStatusStore.getState().startSyncing()
    useDeliverySyncStatusStore.getState().finishSync({ failedPeerCount: 0 })

    useDeliverySyncStatusStore.getState().reset()
    expect(useDeliverySyncStatusStore.getState()).toMatchObject({
      walletGlobalMetaId: null,
      status: 'idle',
      failedPeerCount: 0,
    })
  })
})
