import { useEffect, useMemo, type ReactNode } from 'react'
import {
  hydrateDeliveryForWallet,
  syncKnownPrivateChatHistory,
} from '@/delivery/deliverySync'
import { useMessageStore } from '@/delivery/messageStore'
import { useSocket } from '@/ws/useSocket'
import { useWallet } from '@/wallet/useWallet'

export function WalletHydrator({ children }: { children: ReactNode }) {
  const hydrateFromMetalet = useWallet((s) => s.hydrateFromMetalet)
  const status = useWallet((s) => s.status)
  const identity = useWallet((s) => s.identity)
  const connectSocket = useSocket((s) => s.connect)
  const disconnectSocket = useSocket((s) => s.disconnect)
  const globalMetaId = identity?.globalMetaId ?? ''
  const mvcAddress = identity?.mvcAddress ?? ''
  const btcAddress = identity?.btcAddress ?? ''
  const dogeAddress = identity?.dogeAddress ?? ''
  const lifecycleIdentity = useMemo(
    () =>
      globalMetaId.trim()
        ? {
            globalMetaId,
            mvcAddress,
            btcAddress,
            dogeAddress,
          }
        : null,
    [globalMetaId, mvcAddress, btcAddress, dogeAddress],
  )

  useEffect(() => {
    if (status === 'connected') {
      void hydrateFromMetalet()
    }
  }, [hydrateFromMetalet, status])

  useEffect(() => {
    const gmid = lifecycleIdentity?.globalMetaId.trim()
    if (status === 'connected' && lifecycleIdentity && gmid) {
      let cancelled = false

      void (async () => {
        try {
          await hydrateDeliveryForWallet(lifecycleIdentity)
        } catch (error) {
          console.warn('Could not load saved delivery sessions.', error)
        }
        if (cancelled) return

        connectSocket(lifecycleIdentity)
        void syncKnownPrivateChatHistory(lifecycleIdentity)
          .then((summary) => {
            if (summary.failedPeers.length > 0) {
              console.warn('Could not sync some private chat history peers.', summary.failedPeers)
            }
          })
          .catch((error) => {
            console.warn('Could not sync private chat history.', error)
          })
      })()

      return () => {
        cancelled = true
        disconnectSocket()
        useMessageStore.getState().setSelectedSession(null)
      }
    }
    disconnectSocket()
    useMessageStore.getState().setSelectedSession(null)
  }, [connectSocket, disconnectSocket, lifecycleIdentity, status])

  return children
}
