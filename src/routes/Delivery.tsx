import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { fetchUserProfileByGlobalMetaId, type UserProfile } from '@/api/userProfile'
import { WsErrorBanner } from '@/components/common/WsErrorBanner'
import { DeliveredAssetsPanel } from '@/components/delivery/DeliveredAssetsPanel'
import { DeliveryComposer } from '@/components/delivery/DeliveryComposer'
import { MessageList } from '@/components/delivery/MessageList'
import { SessionHeader } from '@/components/delivery/SessionHeader'
import { SessionsList } from '@/components/delivery/SessionsList'
import { getOrdersForWallet } from '@/delivery/db'
import { buildSessionId } from '@/delivery/domain'
import type { BuyerOrder } from '@/delivery/domain'
import { useMessageStore } from '@/delivery/messageStore'
import { enrichDeliverySessions } from '@/delivery/sessionDisplay'
import {
  buildGroupedSessionList,
  messagesForSession as resolveMessagesForSession,
  parseSessionKey,
  resolveProviderChatPubkey,
} from '@/delivery/sessionGrouping'
import { t } from '@/i18n'
import { useWallet } from '@/wallet/useWallet'
import { useSocket } from '@/ws/useSocket'

const SESSION_PARAM = 'session'

export function DeliveryPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const walletStatus = useWallet((s) => s.status)
  const identity = useWallet((s) => s.identity)
  const walletConnected = walletStatus === 'connected' && identity != null
  const wsConnecting = useSocket((s) => s.status === 'connecting')
  const selfGlobalMetaId = identity?.globalMetaId ?? ''
  const [orders, setOrders] = useState<BuyerOrder[]>([])
  const [providerProfiles, setProviderProfiles] = useState<Record<string, UserProfile>>({})
  const [providerProfileLoading, setProviderProfileLoading] = useState<Record<string, boolean>>({})

  const byPeer = useMessageStore((s) => s.byPeer)
  const assetsBySession = useMessageStore((s) => s.assetsBySession)
  const selectedSessionFromStore = useMessageStore((s) => s.selectedSessionKey)
  const setSelectedSession = useMessageStore((s) => s.setSelectedSession)
  const hydrateFromDb = useMessageStore((s) => s.hydrateFromDb)

  useEffect(() => {
    if (!selfGlobalMetaId) return
    void hydrateFromDb(selfGlobalMetaId).catch((error) => {
      console.warn('Could not load saved delivery sessions.', error)
    })
    if (typeof indexedDB !== 'undefined') {
      void getOrdersForWallet(selfGlobalMetaId)
        .then(setOrders)
        .catch((error) => {
          console.warn('Could not load saved delivery orders.', error)
        })
    }
  }, [hydrateFromDb, selfGlobalMetaId])

  const sessions = useMemo(
    () => buildGroupedSessionList(byPeer, selfGlobalMetaId),
    [byPeer, selfGlobalMetaId],
  )

  const enrichedSessions = useMemo(
    () => enrichDeliverySessions(sessions, byPeer, selfGlobalMetaId),
    [byPeer, sessions, selfGlobalMetaId],
  )

  const sessionFromUrl = searchParams.get(SESSION_PARAM)?.trim() || null
  const selectedSession =
    sessionFromUrl || selectedSessionFromStore || enrichedSessions[0]?.sessionKey || null

  const selectedSessionDetails =
    enrichedSessions.find((session) => session.sessionKey === selectedSession) ?? null

  const messages = useMemo(
    () =>
      selectedSession && selfGlobalMetaId
        ? resolveMessagesForSession(byPeer, selectedSession, selfGlobalMetaId)
        : [],
    [byPeer, selectedSession, selfGlobalMetaId],
  )
  const storedAssets = useMemo(() => {
    if (!selectedSession || !selfGlobalMetaId) return []
    const { peerGlobalMetaId, orderCorrelationId } = parseSessionKey(selectedSession)
    const sessionId = buildSessionId({
      walletGlobalMetaId: selfGlobalMetaId,
      providerGlobalMetaId: peerGlobalMetaId,
      orderCorrelationId,
    })
    return assetsBySession[sessionId] ?? []
  }, [assetsBySession, selectedSession, selfGlobalMetaId])

  const selectedProviderProfile =
    selectedSessionDetails?.peerGlobalMetaId
      ? providerProfiles[selectedSessionDetails.peerGlobalMetaId]
      : undefined
  const selectedProviderChatPubkey = useMemo(
    () =>
      resolveProviderChatPubkey({
        session: selectedSessionDetails,
        orders,
        messages,
        providerProfile: selectedProviderProfile,
      }),
    [messages, orders, selectedProviderProfile, selectedSessionDetails],
  )
  const selectedSessionWithResolvedKey = useMemo(
    () =>
      selectedSessionDetails
        ? {
            ...selectedSessionDetails,
            providerChatPubkey:
              selectedProviderChatPubkey ||
              selectedSessionDetails.providerChatPubkey,
          }
        : null,
    [selectedProviderChatPubkey, selectedSessionDetails],
  )

  const fetchSelectedProviderProfile = useCallback(() => {
    const providerGlobalMetaId = selectedSessionDetails?.peerGlobalMetaId.trim()
    if (!providerGlobalMetaId || providerProfileLoading[providerGlobalMetaId]) return

    setProviderProfileLoading((current) => ({
      ...current,
      [providerGlobalMetaId]: true,
    }))
    void fetchUserProfileByGlobalMetaId(providerGlobalMetaId)
      .then((profile) => {
        setProviderProfiles((current) => ({
          ...current,
          [providerGlobalMetaId]: profile,
        }))
      })
      .catch((error) => {
        console.warn('Could not fetch provider profile.', error)
      })
      .finally(() => {
        setProviderProfileLoading((current) => ({
          ...current,
          [providerGlobalMetaId]: false,
        }))
      })
  }, [providerProfileLoading, selectedSessionDetails])

  useEffect(() => {
    if (!selectedSessionDetails || selectedProviderChatPubkey) return
    if (providerProfiles[selectedSessionDetails.peerGlobalMetaId]) return
    fetchSelectedProviderProfile()
  }, [
    fetchSelectedProviderProfile,
    providerProfiles,
    selectedProviderChatPubkey,
    selectedSessionDetails,
  ])

  const selectSession = useCallback(
    (sessionKey: string) => {
      setSelectedSession(sessionKey)
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          next.set(SESSION_PARAM, sessionKey)
          return next
        },
        { replace: true },
      )
    },
    [setSearchParams, setSelectedSession],
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
        <aside aria-label={t('delivery.sessions')} className="border-b border-hub-border p-3 md:row-span-2 md:border-b-0 md:border-r">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-hub-muted">
            {t('delivery.sessions')}
          </h2>
          <SessionsList
            sessions={enrichedSessions}
            selectedSessionKey={selectedSession}
            onSelectSession={selectSession}
            walletConnected={walletConnected}
            loading={walletConnected && wsConnecting && enrichedSessions.length === 0}
          />
        </aside>

        <div className="flex min-w-0 flex-col md:col-start-2 md:row-start-1">
          <SessionHeader session={selectedSessionWithResolvedKey} />
          <MessageList
            sessionKey={selectedSession}
            messages={messages}
            selfGlobalMetaId={selfGlobalMetaId}
          />
        </div>

        <DeliveredAssetsPanel
          messages={messages}
          storedAssets={storedAssets}
          className="md:col-start-3 md:row-span-2 md:row-start-1"
        />
        <DeliveryComposer
          wallet={walletConnected ? identity : null}
          session={selectedSessionWithResolvedKey}
          providerChatPubkey={selectedProviderChatPubkey}
          providerKeyLoading={Boolean(
            selectedSessionDetails?.peerGlobalMetaId &&
              providerProfileLoading[selectedSessionDetails.peerGlobalMetaId],
          )}
          onFetchProviderKey={selectedSessionDetails ? fetchSelectedProviderProfile : undefined}
        />
      </div>
    </section>
  )
}
