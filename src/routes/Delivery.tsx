import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { fetchUserProfileByGlobalMetaId, type UserProfile } from '@/api/userProfile'
import { WsErrorBanner } from '@/components/common/WsErrorBanner'
import { DeliveredAssetsPanel } from '@/components/delivery/DeliveredAssetsPanel'
import { DeliveryComposer } from '@/components/delivery/DeliveryComposer'
import { MessageList } from '@/components/delivery/MessageList'
import { SessionHeader } from '@/components/delivery/SessionHeader'
import { SessionsList } from '@/components/delivery/SessionsList'
import { getOrdersForWallet } from '@/delivery/db'
import { retryDecryptPeerMessages } from '@/delivery/decryptRetry'
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

function hasDisplayProfile(input: {
  peerName?: string | null
  peerAvatarUrl?: string | null
}): boolean {
  return Boolean(input.peerName?.trim() && input.peerAvatarUrl?.trim())
}

function mergeSessionProfileFallback<
  T extends {
    peerGlobalMetaId: string
    peerName?: string
    peerAvatarUrl?: string
    providerChatPubkey?: string
  },
>(session: T, profile: UserProfile | undefined): T {
  if (!profile) return session
  return {
    ...session,
    providerChatPubkey:
      session.providerChatPubkey?.trim() || profile.chatPubkey?.trim() || undefined,
    peerName: session.peerName?.trim() || profile.name?.trim() || undefined,
    peerAvatarUrl: session.peerAvatarUrl?.trim() || profile.avatarUrl?.trim() || undefined,
  }
}

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
  const providerProfileRequestsRef = useRef<Set<string>>(new Set())
  const providerProfileAttemptedRef = useRef<Set<string>>(new Set())
  const providerProfileRetryRef = useRef<Set<string>>(new Set())

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

  const displaySessions = useMemo(
    () =>
      enrichedSessions.map((session) =>
        mergeSessionProfileFallback(session, providerProfiles[session.peerGlobalMetaId]),
      ),
    [enrichedSessions, providerProfiles],
  )

  const selectedSessionDetails =
    displaySessions.find((session) => session.sessionKey === selectedSession) ?? null

  const messages = useMemo(
    () =>
      selectedSession && selfGlobalMetaId
        ? resolveMessagesForSession(byPeer, selectedSession, selfGlobalMetaId)
        : [],
    [byPeer, selectedSession, selfGlobalMetaId],
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

  const selectedProviderProfile = selectedSessionDetails?.peerGlobalMetaId
    ? providerProfiles[selectedSessionDetails.peerGlobalMetaId]
    : undefined
  const selectedProviderChatPubkey = useMemo(
    () =>
      resolveProviderChatPubkey({
        session: selectedSessionDetails,
        orders,
        messages: messagesWithProfileFallback,
        providerProfile: selectedProviderProfile,
      }),
    [messagesWithProfileFallback, orders, selectedProviderProfile, selectedSessionDetails],
  )
  const selectedSessionWithResolvedKey = useMemo(
    () =>
      selectedSessionDetails
        ? {
            ...selectedSessionDetails,
            providerChatPubkey:
              selectedProviderChatPubkey || selectedSessionDetails.providerChatPubkey,
          }
        : null,
    [selectedProviderChatPubkey, selectedSessionDetails],
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
    if (!selectedSessionDetails) return
    const providerGlobalMetaId = selectedSessionDetails.peerGlobalMetaId
    if (providerProfiles[providerGlobalMetaId]) return
    const needsChatKey = !selectedProviderChatPubkey
    const needsDisplayProfile = !hasDisplayProfile(selectedSessionDetails)
    if (!needsChatKey && !needsDisplayProfile && !selectedHasDecryptGap) return
    void fetchProviderProfile(providerGlobalMetaId, { retryDecrypt: selectedHasDecryptGap })
  }, [
    fetchProviderProfile,
    providerProfiles,
    selectedProviderChatPubkey,
    selectedHasDecryptGap,
    selectedSessionDetails,
  ])

  useEffect(() => {
    if (!selectedSessionDetails || !selectedProviderProfile || !selectedHasDecryptGap) return
    retryDecryptWithProviderProfile(
      selectedSessionDetails.peerGlobalMetaId,
      selectedProviderProfile,
    )
  }, [
    retryDecryptWithProviderProfile,
    selectedHasDecryptGap,
    selectedProviderProfile,
    selectedSessionDetails,
  ])

  useEffect(() => {
    if (!walletConnected) return
    const seenProviderPeers = new Set<string>()
    const missingProviderPeers: string[] = []

    for (const session of displaySessions) {
      const providerGlobalMetaId = session.peerGlobalMetaId.trim()
      if (
        !providerGlobalMetaId ||
        seenProviderPeers.has(providerGlobalMetaId) ||
        providerProfiles[providerGlobalMetaId] ||
        providerProfileRequestsRef.current.has(providerGlobalMetaId) ||
        providerProfileAttemptedRef.current.has(providerGlobalMetaId)
      ) {
        continue
      }

      const missingDisplayProfile = !hasDisplayProfile(session)
      const missingChatKey = !session.providerChatPubkey?.trim()
      if (!missingDisplayProfile && !missingChatKey) continue

      seenProviderPeers.add(providerGlobalMetaId)
      missingProviderPeers.push(providerGlobalMetaId)
      if (missingProviderPeers.length >= 12) break
    }

    for (const providerGlobalMetaId of missingProviderPeers) {
      void fetchProviderProfile(providerGlobalMetaId)
    }
  }, [displaySessions, fetchProviderProfile, providerProfiles, walletConnected])

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
        <aside
          aria-label={t('delivery.sessions')}
          className="border-b border-hub-border p-3 md:row-span-2 md:border-b-0 md:border-r"
        >
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-hub-muted">
            {t('delivery.sessions')}
          </h2>
          <SessionsList
            sessions={displaySessions}
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
            messages={messagesWithProfileFallback}
            selfGlobalMetaId={selfGlobalMetaId}
          />
        </div>

        <DeliveredAssetsPanel
          messages={messagesWithProfileFallback}
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
          onFetchProviderKey={
            selectedSessionDetails
              ? () => {
                  void fetchProviderProfile(selectedSessionDetails.peerGlobalMetaId, {
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
