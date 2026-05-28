import { useCallback, useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { WsErrorBanner } from '@/components/common/WsErrorBanner'
import { MessageList } from '@/components/delivery/MessageList'
import { SessionsList } from '@/components/delivery/SessionsList'
import { useMessageStore } from '@/delivery/messageStore'
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

  const byPeer = useMessageStore((s) => s.byPeer)
  const selectedSessionFromStore = useMessageStore((s) => s.selectedSessionKey)
  const setSelectedSession = useMessageStore((s) => s.setSelectedSession)
  const hydrateFromDb = useMessageStore((s) => s.hydrateFromDb)
  const listSessions = useMessageStore((s) => s.listSessions)
  const messagesForSession = useMessageStore((s) => s.messagesForSession)

  useEffect(() => {
    if (!selfGlobalMetaId) return
    void hydrateFromDb(selfGlobalMetaId).catch((error) => {
      console.warn('Could not load saved delivery sessions.', error)
    })
  }, [hydrateFromDb, selfGlobalMetaId])

  const sessions = useMemo(
    () => listSessions(selfGlobalMetaId),
    [byPeer, listSessions, selfGlobalMetaId],
  )

  const sessionFromUrl = searchParams.get(SESSION_PARAM)?.trim() || null
  const selectedSession =
    sessionFromUrl || selectedSessionFromStore || sessions[0]?.sessionKey || null

  const messages = useMemo(
    () =>
      selectedSession && selfGlobalMetaId
        ? messagesForSession(selectedSession, selfGlobalMetaId)
        : [],
    [messagesForSession, selectedSession, selfGlobalMetaId, byPeer],
  )

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

      <div className="grid min-h-[420px] gap-4 md:grid-cols-[minmax(220px,280px)_1fr]">
        <aside aria-label={t('delivery.sessions')}>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-hub-muted">
            {t('delivery.sessions')}
          </h2>
          <SessionsList
            sessions={sessions}
            selectedSessionKey={selectedSession}
            onSelectSession={selectSession}
            walletConnected={walletConnected}
            loading={walletConnected && wsConnecting && sessions.length === 0}
          />
        </aside>

        <div className="min-w-0">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-hub-muted">
            {t('delivery.messages')}
          </h2>
          <MessageList
            sessionKey={selectedSession}
            messages={messages}
            selfGlobalMetaId={selfGlobalMetaId}
          />
        </div>
      </div>
    </section>
  )
}
