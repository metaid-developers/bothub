import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  fetchUserProfileByGlobalMetaId,
  normalizeAvatarUrl,
  type UserProfile,
} from '@/api/userProfile'
import * as metalet from './metalet'
import type { GlobalMetaidResult, WalletIdentity, WalletStatus } from './types'

interface WalletState {
  identity: WalletIdentity | null
  status: WalletStatus
  errorMessage: string | null
  connect: () => Promise<void>
  disconnect: () => Promise<void>
  hydrateFromMetalet: () => Promise<void>
  clearStaleConnection: () => void
  isWalletReadinessError: (err: unknown) => boolean
}

const STORAGE_KEY = 'bothub-wallet'
const WALLET_READINESS_ERROR_RE =
  /Metalet wallet (?:is not connected to this site|is locked|is not logged in|has no wallet set up|did not respond to (?:ping|isConnected|getGlobalMetaid))|Connected Metalet account changed/i

async function fetchProfileBestEffort(globalMetaId: string): Promise<UserProfile | null> {
  try {
    return await fetchUserProfileByGlobalMetaId(globalMetaId)
  } catch {
    return null
  }
}

function buildWalletIdentity(
  gmid: GlobalMetaidResult,
  profile: UserProfile | null,
): WalletIdentity {
  const avatarUrl =
    profile?.avatarUrl ??
    normalizeAvatarUrl(profile?.avatar, profile?.avatarId ?? profile?.avatarPinId)

  return {
    globalMetaId: gmid.globalMetaId,
    mvcAddress: gmid.mvcAddress,
    btcAddress: gmid.btcAddress,
    dogeAddress: gmid.dogeAddress,
    metaid: profile?.metaid,
    name: profile?.name,
    avatar: profile?.avatar,
    avatarImage: profile?.avatarImage,
    avatarUrl,
    avatarId: profile?.avatarId,
    avatarPinId: profile?.avatarPinId,
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
    avatarImage: identity.avatarImage,
    avatarUrl: identity.avatarUrl,
    avatarId: identity.avatarId,
    avatarPinId: identity.avatarPinId,
    chatPubkey: identity.chatPubkey,
    chatPublicKey: identity.chatPublicKey,
    profileUpdatedAt: identity.profileUpdatedAt,
  }
}

function isWalletReadinessError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err ?? '')
  return WALLET_READINESS_ERROR_RE.test(message)
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

      clearStaleConnection: () => {
        set({ identity: null, status: 'disconnected', errorMessage: null })
      },

      isWalletReadinessError,

      hydrateFromMetalet: async () => {
        const { identity, status } = get()
        if (!identity || status !== 'connected') return
        const installed = metalet.isMetaletInstalled() || (await metalet.waitForMetaletInstalled())
        if (!installed) {
          set({ identity: null, status: 'disconnected', errorMessage: null })
          return
        }
        try {
          const gmid = await metalet.ensureReady()
          const profile = await fetchProfileBestEffort(gmid.globalMetaId)
          set({
            identity: buildWalletIdentity(gmid, profile),
            status: 'connected',
            errorMessage: null,
          })
        } catch {
          set({ identity: null, status: 'disconnected', errorMessage: null })
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
