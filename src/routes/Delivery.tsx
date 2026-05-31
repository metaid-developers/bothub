import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { fetchUserProfileByGlobalMetaId, type UserProfile } from '@/api/userProfile'
import { WsErrorBanner } from '@/components/common/WsErrorBanner'
import { DeliveredAssetsPanel } from '@/components/delivery/DeliveredAssetsPanel'
import { DeliveryComposer } from '@/components/delivery/DeliveryComposer'
import { DeliveryOrderList } from '@/components/delivery/DeliveryOrderList'
import { DeliveryStatusTimeline } from '@/components/delivery/DeliveryStatusTimeline'
import { DeliveryWorkspaceHeader } from '@/components/delivery/DeliveryWorkspaceHeader'
import { getOrdersForWallet } from '@/delivery/db'
import { retryDecryptPeerMessages } from '@/delivery/decryptRetry'
import { buildSessionId, type BuyerOrder } from '@/delivery/domain'
import { useMessageStore } from '@/delivery/messageStore'
import {
  parseSessionKey,
  resolveProviderChatPubkey,
} from '@/delivery/sessionGrouping'
import { useDeliverySyncStatusStore } from '@/delivery/syncStatusStore'
import { t } from '@/i18n'
import { useWallet } from '@/wallet/useWallet'
import {
  buildDeliveryWorkspace,
  selectWorkspaceOrder,
  type WorkspaceOrder,
} from '@/delivery/workspace'
import {
  loadDeliveryWorkspaceRecords,
  type DeliveryWorkspaceRecords,
} from '@/delivery/workspaceRecovery'
import type { EnrichedDeliverySession } from '@/delivery/sessionDisplay'

const ORDER_PARAM = 'order'
const SESSION_PARAM = 'session'

function hasDisplayProfile(input: {
  peerName?: string | null
  peerAvatarUrl?: string | null
}): boolean {
  return Boolean(input.peerName?.trim() && input.peerAvatarUrl?.trim())
}

function workspaceOrderToComposerSession(
  order: WorkspaceOrder,
  profile?: UserProfile,
): EnrichedDeliverySession {
  const messages = order.messages
  const providerChatPubkey =
    order.providerChatPubkey?.trim() || profile?.chatPubkey?.trim() || undefined
  const providerName = order.providerName?.trim() || profile?.name?.trim() || undefined
  const providerAvatarUrl =
    order.providerAvatarUrl?.trim() || profile?.avatarUrl?.trim() || undefined
  return {
    sessionKey: order.sessionKey,
    peerGlobalMetaId: order.providerGlobalMetaId,
    providerChatPubkey,
    peerName: providerName,
    peerAvatarUrl: providerAvatarUrl,
    orderCorrelationId: order.orderCorrelationId,
    serviceLabel: order.serviceLabel,
    lastMessage: messages[messages.length - 1] ?? {
      id: '',
      peerGlobalMetaId: order.providerGlobalMetaId,
      fromGlobalMetaId: order.providerGlobalMetaId,
      toGlobalMetaId: '',
      content: '',
      rawContent: '',
      encryption: 'plain',
      contentType: 'text/plain',
      timestamp: order.lastActivityAt,
    },
    messageCount: order.messageCount,
    status: order.status === 'waiting'
      ? 'pending'
      : order.status === 'failed_to_send'
        ? 'failed'
        : (order.status as 'active' | 'delivering' | 'delivered' | 'completed' | 'failed'),
    assetCount: order.assetCount,
  }
}

export function DeliveryPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const walletStatus = useWallet((s) => s.status)
  const identity = useWallet((s) => s.identity)
  const walletConnected = walletStatus === 'connected' && identity != null
  const selfGlobalMetaId = identity?.globalMetaId ?? ''
  const [orders, setOrders] = useState<BuyerOrder[]>([])
  const [providerProfiles, setProviderProfiles] = useState<Record<string, UserProfile>>({})
  const [providerProfileLoading, setProviderProfileLoading] = useState<Record<string, boolean>>({})
  const providerProfileRequestsRef = useRef<Set<string>>(new Set())
  const providerProfileAttemptedRef = useRef<Set<string>>(new Set())
  const providerProfileRetryRef = useRef<Set<string>>(new Set())

  const byPeer = useMessageStore((s) => s.byPeer)
  const storedAssetsBySession = useMessageStore((s) => s.assetsBySession)
  const hydrateFromDb = useMessageStore((s) => s.hydrateFromDb)
  const syncStatus = useDeliverySyncStatusStore((s) => s.status)
  const syncFailedPeerCount = useDeliverySyncStatusStore((s) => s.failedPeerCount)

  const [workspaceRecords, setWorkspaceRecords] = useState<DeliveryWorkspaceRecords>({
    orders: [],
    sessions: [],
    assetsBySession: {},
  })

  useEffect(() => {
    if (!selfGlobalMetaId) return
    void hydrateFromDb(selfGlobalMetaId).catch((error) => {
      console.warn('Could not load saved delivery sessions.', error)
    })
    if (typeof indexedDB !== 'undefined') {
      void Promise.all([
        getOrdersForWallet(selfGlobalMetaId),
        loadDeliveryWorkspaceRecords(selfGlobalMetaId),
      ])
        .then(([loadedOrders, records]) => {
          setOrders(loadedOrders)
          setWorkspaceRecords(records)
        })
        .catch((error) => {
          console.warn('Could not load saved delivery orders.', error)
        })
    }
  }, [hydrateFromDb, selfGlobalMetaId])

  const mergedAssetsBySession = useMemo(() => {
    const merged: Record<string, ReturnType<typeof useMessageStore.getState>['assetsBySession'][string]> = {}
    for (const [key, assets] of Object.entries(workspaceRecords.assetsBySession)) {
      merged[key] = assets
    }
    for (const [key, assets] of Object.entries(storedAssetsBySession)) {
      merged[key] = assets
    }
    return merged
  }, [storedAssetsBySession, workspaceRecords.assetsBySession])

  const workspace = useMemo(
    () =>
      buildDeliveryWorkspace({
        walletGlobalMetaId: selfGlobalMetaId,
        orders,
        sessions: workspaceRecords.sessions,
        byPeer,
        assetsBySession: mergedAssetsBySession,
      }),
    [selfGlobalMetaId, orders, workspaceRecords.sessions, byPeer, mergedAssetsBySession],
  )

  const orderFromUrl = searchParams.get(ORDER_PARAM)?.trim() || null
  const sessionFromUrl = searchParams.get(SESSION_PARAM)?.trim() || null

  const resolvedSelectedId = useMemo(() => {
    if (orderFromUrl) return orderFromUrl
    if (sessionFromUrl) {
      const { peerGlobalMetaId, orderCorrelationId } = parseSessionKey(sessionFromUrl)
      return buildSessionId({
        walletGlobalMetaId: selfGlobalMetaId,
        providerGlobalMetaId: peerGlobalMetaId,
        orderCorrelationId,
      })
    }
    return workspace.orders[0]?.id || null
  }, [orderFromUrl, sessionFromUrl, workspace.orders, selfGlobalMetaId])

  const selectedOrder = selectWorkspaceOrder(workspace, resolvedSelectedId)

  const workspaceOrdersWithProfiles = useMemo(
    () =>
      workspace.orders.map((order) =>
        mergeWorkspaceOrderProfile(order, providerProfiles[order.providerGlobalMetaId]),
      ),
    [workspace.orders, providerProfiles],
  )

  const messages = useMemo(
    () => selectedOrder?.messages ?? [],
    [selectedOrder],
  )

  const messagesWithProfileFallback = useMemo(
    () =>
      messages.map((message) => {
        const profile = providerProfiles[message.peerGlobalMetaId]
        if (!profile) return message
        return {
          ...message,
          peerChatPubkey: message.peerChatPubkey?.trim() || profile.chatPubkey?.trim() || undefined,
          peerName: message.peerName?.trim() || profile.name?.trim() || undefined,
          peerAvatarUrl: message.peerAvatarUrl?.trim() || profile.avatarUrl?.trim() || undefined,
        }
      }),
    [messages, providerProfiles],
  )

  const selectedHasDecryptGap = useMemo(
    () =>
      messages.some(
        (message) =>
          Boolean(message.decryptError?.trim()) ||
          (message.content === message.rawContent &&
            message.encryption.trim().toLowerCase() === 'ecdh'),
      ),
    [messages],
  )

  const selectedProviderChatPubkey = useMemo(
    () =>
      resolveProviderChatPubkey({
        session: selectedOrder
          ? {
              peerGlobalMetaId: selectedOrder.providerGlobalMetaId,
              providerChatPubkey: selectedOrder.providerChatPubkey,
              orderCorrelationId: selectedOrder.orderCorrelationId,
            }
          : null,
        orders: orders.map((order) => ({
          providerGlobalMetaId: order.providerGlobalMetaId,
          providerChatPubkey: order.providerChatPubkey,
          orderCorrelationId: order.orderReference,
          paymentTxid: order.paymentTxid,
          orderReference: order.orderReference,
        })),
        messages,
        providerProfile: selectedOrder?.providerGlobalMetaId
          ? providerProfiles[selectedOrder.providerGlobalMetaId]
          : undefined,
      }),
    [messages, orders, providerProfiles, selectedOrder],
  )

  const composerSession = useMemo(() => {
    if (!selectedOrder) return null
    const profile = providerProfiles[selectedOrder.providerGlobalMetaId]
    return workspaceOrderToComposerSession(
      {
        ...selectedOrder,
        providerChatPubkey: selectedProviderChatPubkey || selectedOrder.providerChatPubkey,
      },
      profile,
    )
  }, [selectedOrder, selectedProviderChatPubkey, providerProfiles])

  const retryDecryptWithProviderProfile = useCallback(
    (peerGlobalMetaId: string, profile: UserProfile): void => {
      const peer = peerGlobalMetaId.trim()
      const chatPubkey = profile.chatPubkey?.trim()
      const walletGlobalMetaId = identity?.globalMetaId.trim()
      if (!walletConnected || !identity || !walletGlobalMetaId || !peer || !chatPubkey) {
        return
      }

      const retryKey = `${walletGlobalMetaId}:${peer}:${chatPubkey}`
      if (providerProfileRetryRef.current.has(retryKey)) return
      providerProfileRetryRef.current.add(retryKey)

      void retryDecryptPeerMessages({
        walletIdentity: identity,
        peerGlobalMetaId: peer,
        peerProfile: {
          chatPubkey,
          name: profile.name,
          avatarUrl: profile.avatarUrl,
        },
      }).catch((error) => {
        console.warn('Could not retry delivery decrypt after profile hydration.', error)
      })
    },
    [identity, walletConnected],
  )

  const fetchProviderProfile = useCallback(
    async (
      providerGlobalMetaId: string,
      options?: { force?: boolean; retryDecrypt?: boolean },
    ): Promise<UserProfile | undefined> => {
      const peer = providerGlobalMetaId.trim()
      const cachedProfile = providerProfiles[peer]
      if (
        !peer ||
        providerProfileRequestsRef.current.has(peer) ||
        (!options?.force && (cachedProfile || providerProfileAttemptedRef.current.has(peer)))
      ) {
        return cachedProfile
      }

      providerProfileRequestsRef.current.add(peer)
      providerProfileAttemptedRef.current.add(peer)
      setProviderProfileLoading((current) => ({
        ...current,
        [peer]: true,
      }))

      try {
        const profile = await fetchUserProfileByGlobalMetaId(peer)
        setProviderProfiles((current) => ({
          ...current,
          [peer]: profile,
        }))

        if (options?.retryDecrypt) {
          retryDecryptWithProviderProfile(peer, profile)
        }

        return profile
      } catch (error) {
        console.warn('Could not fetch provider profile.', error)
        return undefined
      } finally {
        providerProfileRequestsRef.current.delete(peer)
        setProviderProfileLoading((current) => ({
          ...current,
          [peer]: false,
        }))
      }
    },
    [providerProfiles, retryDecryptWithProviderProfile],
  )

  useEffect(() => {
    if (!selectedOrder) return
    const providerGlobalMetaId = selectedOrder.providerGlobalMetaId
    if (providerProfiles[providerGlobalMetaId]) return
    const needsChatKey = !selectedProviderChatPubkey
    const needsDisplayProfile = !hasDisplayProfile({
      peerName: selectedOrder.providerName,
      peerAvatarUrl: selectedOrder.providerAvatarUrl,
    })
    if (!needsChatKey && !needsDisplayProfile && !selectedHasDecryptGap) return
    void fetchProviderProfile(providerGlobalMetaId, { retryDecrypt: selectedHasDecryptGap })
  }, [
    fetchProviderProfile,
    providerProfiles,
    selectedProviderChatPubkey,
    selectedHasDecryptGap,
    selectedOrder,
  ])

  useEffect(() => {
    if (!selectedOrder || !selectedProviderChatPubkey || !selectedHasDecryptGap) return
    const profile = providerProfiles[selectedOrder.providerGlobalMetaId]
    if (!profile) return
    retryDecryptWithProviderProfile(selectedOrder.providerGlobalMetaId, profile)
  }, [
    retryDecryptWithProviderProfile,
    selectedHasDecryptGap,
    selectedProviderChatPubkey,
    selectedOrder,
    providerProfiles,
  ])

  useEffect(() => {
    if (!walletConnected) return
    const seenProviderPeers = new Set<string>()
    const missingProviderPeers: string[] = []

    for (const workspaceOrder of workspace.orders) {
      const providerGlobalMetaId = workspaceOrder.providerGlobalMetaId.trim()
      if (
        !providerGlobalMetaId ||
        seenProviderPeers.has(providerGlobalMetaId) ||
        providerProfiles[providerGlobalMetaId] ||
        providerProfileRequestsRef.current.has(providerGlobalMetaId) ||
        providerProfileAttemptedRef.current.has(providerGlobalMetaId)
      ) {
        continue
      }

      const missingDisplayProfile = !hasDisplayProfile({
        peerName: workspaceOrder.providerName,
        peerAvatarUrl: workspaceOrder.providerAvatarUrl,
      })
      const missingChatKey = !workspaceOrder.providerChatPubkey?.trim()
      if (!missingDisplayProfile && !missingChatKey) continue

      seenProviderPeers.add(providerGlobalMetaId)
      missingProviderPeers.push(providerGlobalMetaId)
      if (missingProviderPeers.length >= 12) break
    }

    for (const providerGlobalMetaId of missingProviderPeers) {
      void fetchProviderProfile(providerGlobalMetaId)
    }
  }, [workspace.orders, fetchProviderProfile, providerProfiles, walletConnected])

  const selectOrder = useCallback(
    (orderId: string) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          next.set(ORDER_PARAM, orderId)
          next.delete(SESSION_PARAM)
          return next
        },
        { replace: true },
      )
    },
    [setSearchParams],
  )

  return (
    <section aria-labelledby="delivery-heading" className="space-y-4">
      <div>
        <h1 id="delivery-heading" className="font-display text-2xl font-semibold">
          {t('delivery.title')}
        </h1>
        <p className="mt-2 max-w-xl text-hub-muted">{t('delivery.subtitle')}</p>
      </div>

      <WsErrorBanner />

      <div className="grid min-h-[560px] overflow-hidden rounded-card border border-hub-border bg-hub-surface/30 md:grid-cols-[minmax(220px,280px)_minmax(0,1fr)_minmax(220px,280px)] md:grid-rows-[minmax(0,1fr)_auto]">
        <aside
          aria-label={t('delivery.workspace.orders')}
          className="border-b border-hub-border p-3 md:row-span-2 md:border-b-0 md:border-r"
        >
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-hub-muted">
            {t('delivery.workspace.orders')}
          </h2>
          <DeliveryOrderList
            orders={workspaceOrdersWithProfiles}
            selectedOrderId={resolvedSelectedId}
            walletConnected={walletConnected}
            syncStatus={syncStatus}
            failedPeerCount={syncFailedPeerCount}
            onSelectOrder={selectOrder}
          />
        </aside>

        <div className="flex min-w-0 flex-col md:col-start-2 md:row-start-1">
          <DeliveryWorkspaceHeader order={selectedOrder} />
          <DeliveryStatusTimeline
            order={selectedOrder}
            selfGlobalMetaId={selfGlobalMetaId}
          />
        </div>

        <DeliveredAssetsPanel
          messages={messagesWithProfileFallback}
          storedAssets={
            selectedOrder
              ? mergedAssetsBySession[selectedOrder.sessionId] ?? []
              : []
          }
          className="md:col-start-3 md:row-span-2 md:row-start-1"
        />
        <DeliveryComposer
          wallet={walletConnected ? identity : null}
          session={composerSession}
          providerChatPubkey={selectedProviderChatPubkey}
          providerKeyLoading={Boolean(
            selectedOrder?.providerGlobalMetaId &&
            providerProfileLoading[selectedOrder.providerGlobalMetaId],
          )}
          onFetchProviderKey={
            selectedOrder
              ? () => {
                  void fetchProviderProfile(selectedOrder.providerGlobalMetaId, {
                    force: true,
                    retryDecrypt: selectedHasDecryptGap,
                  })
                }
              : undefined
          }
        />
      </div>
    </section>
  )
}

function mergeWorkspaceOrderProfile(
  order: WorkspaceOrder,
  profile: UserProfile | undefined,
): WorkspaceOrder {
  if (!profile) return order
  return {
    ...order,
    providerChatPubkey:
      order.providerChatPubkey?.trim() || profile.chatPubkey?.trim() || undefined,
    providerName: order.providerName?.trim() || profile.name?.trim() || undefined,
    providerAvatarUrl:
      order.providerAvatarUrl?.trim() || profile.avatarUrl?.trim() || undefined,
  }
}
