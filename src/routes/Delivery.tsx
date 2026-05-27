import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { MessageList } from '@/components/delivery/MessageList'
import { SessionsList } from '@/components/delivery/SessionsList'
import { buildSessionList, useMessageStore } from '@/delivery/messageStore'
import { useWallet } from '@/wallet/useWallet'

const SESSION_PARAM = 'session'

export function DeliveryPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const walletStatus = useWallet((s) => s.status)
  const identity = useWallet((s) => s.identity)
  const walletConnected = walletStatus === 'connected' && identity != null

  const byPeer = useMessageStore((s) => s.byPeer)
  const selectedPeerFromStore = useMessageStore((s) => s.selectedPeerGlobalMetaId)
  const setSelectedPeer = useMessageStore((s) => s.setSelectedPeer)
  const messagesForPeer = useMessageStore((s) => s.messagesForPeer)

  const sessions = useMemo(() => buildSessionList(byPeer), [byPeer])

  const sessionFromUrl = searchParams.get(SESSION_PARAM)?.trim() || null
  const peerFromSessionKey = sessionFromUrl?.split(':')[0]?.trim() || null

  const selectedPeer =
    peerFromSessionKey || selectedPeerFromStore || sessions[0]?.peerGlobalMetaId || null

  const messages = useMemo(
    () => (selectedPeer ? messagesForPeer(selectedPeer) : []),
    [messagesForPeer, selectedPeer],
  )

  const selectPeer = useCallback(
    (peerGlobalMetaId: string) => {
      setSelectedPeer(peerGlobalMetaId)
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          next.set(SESSION_PARAM, peerGlobalMetaId)
          return next
        },
        { replace: true },
      )
    },
    [setSearchParams, setSelectedPeer],
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
            selectedPeerGlobalMetaId={selectedPeer}
            onSelectPeer={selectPeer}
            walletConnected={walletConnected}
          />
        </aside>

        <div>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-hub-muted">
            Messages
          </h2>
          <MessageList
            peerGlobalMetaId={selectedPeer}
            messages={messages}
            selfGlobalMetaId={identity?.globalMetaId ?? ''}
          />
        </div>
      </div>
    </section>
  )
}
