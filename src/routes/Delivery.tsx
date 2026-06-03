import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { fetchUserProfileByGlobalMetaId, type UserProfile } from '@/api/userProfile'
import { WsErrorBanner } from '@/components/common/WsErrorBanner'
import { DeliveryAssetLibrary } from '@/components/delivery/DeliveryAssetLibrary'
import { DeliveryComposer } from '@/components/delivery/DeliveryComposer'
import { DeliveryConversationHeader } from '@/components/delivery/DeliveryConversationHeader'
import { DeliveryConversationList } from '@/components/delivery/DeliveryConversationList'
import { DeliveryOrderTabs } from '@/components/delivery/DeliveryOrderTabs'
import { DeliveryStatusTimeline } from '@/components/delivery/DeliveryStatusTimeline'
import { DeliveryWorkspaceHeader } from '@/components/delivery/DeliveryWorkspaceHeader'
import { getOrdersForWallet } from '@/delivery/db'
import { retryDecryptPeerMessages } from '@/delivery/decryptRetry'
import type { BuyerOrder } from '@/delivery/domain'
import { useMessageStore } from '@/delivery/messageStore'
import { resolveProviderChatPubkey } from '@/delivery/sessionGrouping'
import { useDeliverySyncStatusStore } from '@/delivery/syncStatusStore'
import { t } from '@/i18n'
import { useWallet } from '@/wallet/useWallet'
import {
  type WorkspaceOrder,
} from '@/delivery/workspace'
import {
  assetsForConversation,
  buildDeliveryConversations,
  messagesForConversation,
  resolveDeliveryRouteSelection,
  selectDeliveryConversation,
  selectDeliveryTab,
  selectOrderThread,
  type DeliveryConversation,
} from '@/delivery/conversationWorkspace'
import {
  loadDeliveryWorkspaceRecords,
  type DeliveryWorkspaceRecords,
} from '@/delivery/workspaceRecovery'
import type { EnrichedDeliverySession } from '@/delivery/sessionDisplay'

const CONVERSATION_PARAM = 'conversation'
const ORDER_PARAM = 'order'
const SESSION_PARAM = 'session'

function hasDisplayProfile(input: {
  peerName?: string | null
  peerAvatarUrl?: string | null
}): boolean {
  return Boolean(input.peerName?.trim() && input.peerAvatarUrl?.trim())
}

function uniqueProviderIds(values: Array<string | null | undefined>): string[] {
  return Array.from(
    new Set(values.map((value) => value?.trim() ?? '').filter(Boolean)),
  )
}

function providerIdsForConversation(
  conversation: DeliveryConversation | null,
): string[] {
  if (!conversation) return []
  return uniqueProviderIds([
    conversation.providerGlobalMetaId,
    conversation.id,
    ...conversation.orderThreads.map((thread) => thread.order.providerGlobalMetaId),
    ...conversation.messages.map((message) => message.peerGlobalMetaId),
  ])
}

function deliveryAssetScopeLabel(input: {
  conversation: DeliveryConversation | null
  order: WorkspaceOrder | null
  tab: ReturnType<typeof selectDeliveryTab>
}): string | undefined {
  if (!input.conversation) return undefined

  if (input.tab.kind === 'all') {
    const providerLabel =
      input.conversation.providerName?.trim() ||
      input.conversation.providerGlobalMetaId.trim()
    return providerLabel
      ? `${t('delivery.workspace.assetScopeAll')} - ${providerLabel}`
      : undefined
  }

  const orderLabel =
    input.order?.serviceLabel.trim() ||
    input.order?.requestSummary.trim() ||
    input.order?.id.trim() ||
    input.tab.orderId.trim()
  return orderLabel
    ? `${t('delivery.workspace.assetScopeOrder')} - ${orderLabel}`
    : undefined
}

function resolveConversationProviderProfile(
  conversation: DeliveryConversation | null,
  providerProfiles: Record<string, UserProfile>,
): UserProfile | undefined {
  return providerIdsForConversation(conversation)
    .map((providerId) => providerProfiles[providerId])
    .find((profile) => profile != null)
}

function conversationToComposerSession(
  conversation: DeliveryConversation,
  resolvedProviderChatPubkey: string,
  profile?: UserProfile,
): EnrichedDeliverySession {
  const messages = conversation.messages
  const providerChatPubkey =
    resolvedProviderChatPubkey.trim() ||
    conversation.providerChatPubkey?.trim() ||
    profile?.chatPubkey?.trim() ||
    undefined
  const providerName =
    conversation.providerName?.trim() || profile?.name?.trim() || undefined
  const providerAvatarUrl =
    conversation.providerAvatarUrl?.trim() || profile?.avatarUrl?.trim() || undefined
  return {
    sessionKey: conversation.providerGlobalMetaId,
    peerGlobalMetaId: conversation.providerGlobalMetaId,
    providerChatPubkey,
    peerName: providerName,
    peerAvatarUrl: providerAvatarUrl,
    orderCorrelationId: null,
    serviceLabel: null,
    lastMessage: messages[messages.length - 1] ?? {
      id: '',
      peerGlobalMetaId: conversation.providerGlobalMetaId,
      fromGlobalMetaId: conversation.providerGlobalMetaId,
      toGlobalMetaId: '',
      content: '',
      rawContent: '',
      encryption: 'plain',
      contentType: 'text/plain',
      timestamp: conversation.latestActivityAt,
    },
    messageCount: conversation.messageCount,
    status: conversation.activeOrderCount > 0
      ? 'active'
      : conversation.deliveredOrderCount > 0
        ? 'completed'
        : 'pending',
    assetCount: conversation.assetCount,
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
      buildDeliveryConversations({
        walletGlobalMetaId: selfGlobalMetaId,
        orders,
        sessions: workspaceRecords.sessions,
        byPeer,
        assetsBySession: mergedAssetsBySession,
      }),
    [selfGlobalMetaId, orders, workspaceRecords.sessions, byPeer, mergedAssetsBySession],
  )

  const conversationFromUrl = searchParams.get(CONVERSATION_PARAM)?.trim() || null
  const orderFromUrl = searchParams.get(ORDER_PARAM)?.trim() || null
  const sessionFromUrl = searchParams.get(SESSION_PARAM)?.trim() || null

  const resolvedRouteSelection = useMemo(
    () =>
      resolveDeliveryRouteSelection({
        workspace,
        conversationParam: conversationFromUrl,
        orderParam: orderFromUrl,
        sessionParam: sessionFromUrl,
        walletGlobalMetaId: selfGlobalMetaId,
      }),
    [conversationFromUrl, orderFromUrl, sessionFromUrl, selfGlobalMetaId, workspace],
  )

  const selectedConversation = selectDeliveryConversation(
    workspace,
    resolvedRouteSelection.conversationId,
  )
  const selectedTab = selectDeliveryTab(
    selectedConversation,
    resolvedRouteSelection.tabId,
  )
  const selectedOrderThread = selectOrderThread(selectedConversation, selectedTab)

  const selectedMessages = useMemo(
    () => messagesForConversation(selectedConversation, selectedTab),
    [selectedConversation, selectedTab],
  )

  const selectedProviderIds = useMemo(
    () => providerIdsForConversation(selectedConversation),
    [selectedConversation],
  )

  const selectedProviderProfile = useMemo(
    () => resolveConversationProviderProfile(selectedConversation, providerProfiles),
    [providerProfiles, selectedConversation],
  )

  const messagesWithProfileFallback = useMemo(
    () =>
      selectedMessages.map((message) => {
        const profile = providerProfiles[message.peerGlobalMetaId] ?? selectedProviderProfile
        if (!profile) return message
        return {
          ...message,
          peerChatPubkey: message.peerChatPubkey?.trim() || profile.chatPubkey?.trim() || undefined,
          peerName: message.peerName?.trim() || profile.name?.trim() || undefined,
          peerAvatarUrl: message.peerAvatarUrl?.trim() || profile.avatarUrl?.trim() || undefined,
        }
      }),
    [selectedMessages, providerProfiles, selectedProviderProfile],
  )

  const selectedHasDecryptGap = useMemo(
    () =>
      (selectedConversation?.messages ?? []).some(
        (message) =>
          Boolean(message.decryptError?.trim()) ||
          (message.content === message.rawContent &&
            message.encryption.trim().toLowerCase() === 'ecdh'),
      ),
    [selectedConversation],
  )

  const selectedProviderChatPubkey = useMemo(
    () =>
      resolveProviderChatPubkey({
        session: selectedConversation
          ? {
              peerGlobalMetaId: selectedConversation.providerGlobalMetaId,
              providerChatPubkey: selectedConversation.providerChatPubkey,
              orderCorrelationId:
                selectedTab.kind === 'order' ? selectedTab.orderCorrelationId : null,
            }
          : null,
        orders: orders.map((order) => ({
          providerGlobalMetaId: order.providerGlobalMetaId,
          providerChatPubkey: order.providerChatPubkey,
          orderPinId: order.orderPinId,
          orderCorrelationId:
            order.orderPinId?.trim() ||
            order.paymentTxid?.trim() ||
            order.orderReference?.trim() ||
            undefined,
          paymentTxid: order.paymentTxid,
          orderReference: order.orderReference,
        })),
        messages: selectedConversation?.messages ?? [],
        providerProfile: selectedProviderProfile,
      }),
    [orders, selectedConversation, selectedProviderProfile, selectedTab],
  )

  const composerSession = useMemo(() => {
    if (!selectedConversation || selectedTab.kind !== 'all') return null
    return conversationToComposerSession(
      selectedConversation,
      selectedProviderChatPubkey,
      selectedProviderProfile,
    )
  }, [selectedConversation, selectedProviderChatPubkey, selectedProviderProfile, selectedTab])

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
    if (!selectedConversation) return
    const providerGlobalMetaId = selectedConversation.providerGlobalMetaId
    if (providerProfiles[providerGlobalMetaId]) return
    const needsChatKey = !selectedProviderChatPubkey
    const needsDisplayProfile = !hasDisplayProfile({
      peerName: selectedConversation.providerName,
      peerAvatarUrl: selectedConversation.providerAvatarUrl,
    })
    if (!needsChatKey && !needsDisplayProfile && !selectedHasDecryptGap) return
    void fetchProviderProfile(providerGlobalMetaId, { retryDecrypt: selectedHasDecryptGap })
  }, [
    fetchProviderProfile,
    providerProfiles,
    selectedProviderChatPubkey,
    selectedHasDecryptGap,
    selectedConversation,
  ])

  useEffect(() => {
    if (!selectedConversation || !selectedProviderChatPubkey || !selectedHasDecryptGap) return
    if (!selectedProviderProfile) return
    retryDecryptWithProviderProfile(selectedConversation.providerGlobalMetaId, selectedProviderProfile)
  }, [
    retryDecryptWithProviderProfile,
    selectedHasDecryptGap,
    selectedProviderChatPubkey,
    selectedConversation,
    selectedProviderProfile,
  ])

  useEffect(() => {
    if (!walletConnected) return
    const seenProviderPeers = new Set<string>()
    const missingProviderPeers: string[] = []

    for (const conversation of workspace.conversations) {
      const providerGlobalMetaId = conversation.providerGlobalMetaId.trim()
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
        peerName: conversation.providerName,
        peerAvatarUrl: conversation.providerAvatarUrl,
      })
      const missingChatKey = !conversation.providerChatPubkey?.trim()
      if (!missingDisplayProfile && !missingChatKey) continue

      seenProviderPeers.add(providerGlobalMetaId)
      missingProviderPeers.push(providerGlobalMetaId)
      if (missingProviderPeers.length >= 12) break
    }

    for (const providerGlobalMetaId of missingProviderPeers) {
      void fetchProviderProfile(providerGlobalMetaId)
    }
  }, [workspace.conversations, fetchProviderProfile, providerProfiles, walletConnected])

  const selectConversation = useCallback(
    (conversationId: string) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          next.set(CONVERSATION_PARAM, conversationId)
          next.delete(ORDER_PARAM)
          next.delete(SESSION_PARAM)
          return next
        },
        { replace: true },
      )
    },
    [setSearchParams],
  )

  const selectTab = useCallback(
    (tabId: string) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          if (selectedConversation) {
            next.set(CONVERSATION_PARAM, selectedConversation.id)
          }
          next.delete(SESSION_PARAM)
          if (tabId === 'all') {
            next.delete(ORDER_PARAM)
            return next
          }

          const tab = selectDeliveryTab(selectedConversation, tabId)
          const thread = selectOrderThread(selectedConversation, tab)
          if (thread) {
            next.set(ORDER_PARAM, thread.orderCorrelationId)
          } else {
            next.delete(ORDER_PARAM)
          }
          return next
        },
        { replace: true },
      )
    },
    [selectedConversation, setSearchParams],
  )

  const selectedConversationWithProfile = useMemo(
    () =>
      selectedConversation
        ? mergeConversationProfile(
            selectedConversation,
            selectedProviderProfile,
          )
        : null,
    [selectedConversation, selectedProviderProfile],
  )

  const selectedOrderWithProfile = useMemo(() => {
    if (!selectedOrderThread) return null
    return mergeWorkspaceOrderProfile(
      selectedOrderThread.order,
      selectedProviderProfile,
    )
  }, [selectedOrderThread, selectedProviderProfile])

  const orderForTimeline = useMemo(() => {
    if (!selectedOrderWithProfile) return null
    return {
      ...selectedOrderWithProfile,
      messages: messagesWithProfileFallback,
    }
  }, [selectedOrderWithProfile, messagesWithProfileFallback])

  const selectedAssets = useMemo(
    () => assetsForConversation(selectedConversation, selectedTab),
    [selectedConversation, selectedTab],
  )

  const selectedAssetScopeLabel = useMemo(
    () =>
      deliveryAssetScopeLabel({
        conversation: selectedConversationWithProfile,
        order: selectedOrderWithProfile,
        tab: selectedTab,
      }),
    [selectedConversationWithProfile, selectedOrderWithProfile, selectedTab],
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
          aria-label={t('delivery.workspace.conversations')}
          className="border-b border-hub-border p-3 md:row-span-2 md:border-b-0 md:border-r"
        >
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-hub-muted">
            {t('delivery.workspace.conversations')}
          </h2>
          <DeliveryConversationList
            conversations={workspace.conversations.map((conversation) =>
              mergeConversationProfile(
                conversation,
                resolveConversationProviderProfile(conversation, providerProfiles),
              ),
            )}
            selectedConversationId={selectedConversation?.id ?? null}
            walletConnected={walletConnected}
            syncStatus={syncStatus}
            failedPeerCount={syncFailedPeerCount}
            onSelectConversation={selectConversation}
          />
        </aside>

        <div className="flex min-w-0 flex-col md:col-start-2 md:row-start-1">
          <DeliveryConversationHeader conversation={selectedConversationWithProfile} />
          <DeliveryOrderTabs
            conversation={selectedConversationWithProfile}
            selectedTabId={selectedTab.id}
            onSelectTab={selectTab}
          />
          {selectedTab.kind === 'order' ? (
            <>
              <DeliveryWorkspaceHeader order={selectedOrderWithProfile} />
              <DeliveryStatusTimeline
                mode="order"
                order={orderForTimeline}
                selfGlobalMetaId={selfGlobalMetaId}
              />
            </>
          ) : (
            <DeliveryStatusTimeline
              mode="all"
              order={null}
              messages={messagesWithProfileFallback}
              selfGlobalMetaId={selfGlobalMetaId}
            />
          )}
        </div>

        <DeliveryAssetLibrary assets={selectedAssets} scopeLabel={selectedAssetScopeLabel} />
        {selectedTab.kind === 'all' && (
          <DeliveryComposer
            wallet={walletConnected ? identity : null}
            session={composerSession}
            providerChatPubkey={selectedProviderChatPubkey}
            providerKeyLoading={selectedProviderIds.some(
              (providerId) => providerProfileLoading[providerId],
            )}
            onFetchProviderKey={
              selectedConversation
                ? () => {
                    void fetchProviderProfile(selectedConversation.providerGlobalMetaId, {
                      force: true,
                      retryDecrypt: selectedHasDecryptGap,
                    })
                  }
                : undefined
            }
          />
        )}
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

function mergeConversationProfile(
  conversation: DeliveryConversation,
  profile: UserProfile | undefined,
): DeliveryConversation {
  if (!profile) return conversation
  return {
    ...conversation,
    providerChatPubkey:
      conversation.providerChatPubkey?.trim() || profile.chatPubkey?.trim() || undefined,
    providerName: conversation.providerName?.trim() || profile.name?.trim() || undefined,
    providerAvatarUrl:
      conversation.providerAvatarUrl?.trim() || profile.avatarUrl?.trim() || undefined,
  }
}
