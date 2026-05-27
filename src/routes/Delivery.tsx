import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { MessageList } from '@/components/delivery/MessageList'
import { SessionsList } from '@/components/delivery/SessionsList'
import { useMessageStore } from '@/delivery/messageStore'
import { useWallet } from '@/wallet/useWallet'

const SESSION_PARAM = 'session'

export function DeliveryPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const walletStatus = useWallet((s) => s.status)
  const identity = useWallet((s) => s.identity)
  const walletConnected = walletStatus === 'connected' && identity != null
  const selfGlobalMetaId = identity?.globalMetaId ?? ''

  const byPeer = useMessageStore((s) => s.byPeer)
  const selectedSessionFromStore = useMessageStore((s) => s.selectedSessionKey)
  const setSelectedSession = useMessageStore((s) => s.setSelectedSession)
  const listSessions = useMessageStore((s) => s.listSessions)
  const messagesForSession = useMessageStore((s) => s.messagesForSession)

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
          Delivery
        </h1>
        <p className="mt-2 max-w-xl text-hub-muted">
          Private simplemsg sessions delivered over meta-socket Socket.IO.
        </p>
      </div>

      <div className="grid min-h-[420px] gap-4 lg:grid-cols-[minmax(220px,280px)_1fr]">
        <aside aria-label="Sessions">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-hub-muted">
            Sessions
          </h2>
          <SessionsList
            sessions={sessions}
            selectedSessionKey={selectedSession}
            onSelectSession={selectSession}
            walletConnected={walletConnected}
          />
        </aside>

        <div>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-hub-muted">
            Messages
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
