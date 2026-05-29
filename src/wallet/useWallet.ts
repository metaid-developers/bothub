import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { fetchUserProfileByGlobalMetaId, type UserProfile } from '@/api/userProfile'
import * as metalet from './metalet'
import type { GlobalMetaidResult, WalletIdentity, WalletStatus } from './types'

interface WalletState {
  identity: WalletIdentity | null
  status: WalletStatus
  errorMessage: string | null
  connect: () => Promise<void>
  disconnect: () => Promise<void>
  hydrateFromMetalet: () => Promise<void>
}

const STORAGE_KEY = 'bothub-wallet'

async function fetchProfileBestEffort(globalMetaId: string): Promise<UserProfile | null> {
  try {
    return await fetchUserProfileByGlobalMetaId(globalMetaId)
  } catch {
    return null
  }
}

function buildWalletIdentity(gmid: GlobalMetaidResult, profile: UserProfile | null): WalletIdentity {
  return {
    globalMetaId: gmid.globalMetaId,
    mvcAddress: gmid.mvcAddress,
    btcAddress: gmid.btcAddress,
    dogeAddress: gmid.dogeAddress,
    metaid: profile?.metaid,
    name: profile?.name,
    avatar: profile?.avatar,
    avatarUrl: profile?.avatarUrl,
    chatPubkey: profile?.chatPubkey,
    chatPublicKey: profile?.chatPubkey,
    profileUpdatedAt: profile ? Date.now() : undefined,
  }
}

function persistableIdentity(identity: WalletIdentity | null): WalletIdentity | null {
  if (!identity) return null
  return {
    globalMetaId: identity.globalMetaId,
    mvcAddress: identity.mvcAddress,
    btcAddress: identity.btcAddress,
    dogeAddress: identity.dogeAddress,
    metaid: identity.metaid,
    name: identity.name,
    avatar: identity.avatar,
    avatarUrl: identity.avatarUrl,
    chatPubkey: identity.chatPubkey,
    chatPublicKey: identity.chatPublicKey,
    profileUpdatedAt: identity.profileUpdatedAt,
  }
}

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
          const profile = await fetchProfileBestEffort(gmid.globalMetaId)
          const identity = buildWalletIdentity(gmid, profile)
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
          const profile = await fetchProfileBestEffort(gmid.globalMetaId)
          set({
            identity: buildWalletIdentity(gmid, profile),
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
        identity: persistableIdentity(state.identity),
        status: state.status === 'connected' ? 'connected' : 'disconnected',
      }),
      onRehydrateStorage: () => (state) => {
        if (!state) return
        if (!state.identity?.globalMetaId?.trim()) {
          state.identity = null
          state.status = 'disconnected'
          state.errorMessage = null
        }
      },
    },
  ),
)
