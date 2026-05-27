import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import * as metalet from './metalet'
import type { WalletIdentity, WalletStatus } from './types'

interface WalletState {
  identity: WalletIdentity | null
  status: WalletStatus
  errorMessage: string | null
  connect: () => Promise<void>
  disconnect: () => Promise<void>
  hydrateFromMetalet: () => Promise<void>
}

const STORAGE_KEY = 'bothub-wallet'

export const useWallet = create<WalletState>()(
  persist(
    (set, get) => ({
      identity: null,
      status: 'disconnected',
      errorMessage: null,

      connect: async () => {
        set({ status: 'connecting', errorMessage: null })
        try {
          await metalet.connect()
          const gmid = await metalet.getGlobalMetaid()
          const identity: WalletIdentity = {
            globalMetaId: gmid.globalMetaId,
            mvcAddress: gmid.mvcAddress,
            btcAddress: gmid.btcAddress,
            dogeAddress: gmid.dogeAddress,
          }
          set({ identity, status: 'connected', errorMessage: null })
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err)
          set({ status: 'error', errorMessage: message })
          throw err
        }
      },

      disconnect: async () => {
        try {
          if (metalet.isMetaletInstalled()) {
            await metalet.disconnect()
          }
        } catch {
          // ignore disconnect errors when extension unavailable
        }
        set({ identity: null, status: 'disconnected', errorMessage: null })
      },

      hydrateFromMetalet: async () => {
        const { identity, status } = get()
        if (!identity || status !== 'connected') return
        if (!metalet.isMetaletInstalled()) return
        try {
          const gmid = await metalet.getGlobalMetaid()
          set({
            identity: {
              globalMetaId: gmid.globalMetaId,
              mvcAddress: gmid.mvcAddress,
              btcAddress: gmid.btcAddress,
              dogeAddress: gmid.dogeAddress,
            },
            status: 'connected',
            errorMessage: null,
          })
        } catch {
          set({ identity: null, status: 'disconnected' })
        }
      },
    }),
    {
      name: STORAGE_KEY,
      partialize: (state) => ({
        identity: state.identity,
        status: state.status === 'connected' ? 'connected' : 'disconnected',
      }),
    },
  ),
)
