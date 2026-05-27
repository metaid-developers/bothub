import { clsx } from 'clsx'
import type { DeliverySession } from '@/delivery/messageStore'
import { truncateGlobalMetaId } from '@/wallet/format'

export interface SessionsListProps {
  sessions: DeliverySession[]
  selectedPeerGlobalMetaId: string | null
  onSelectPeer: (peerGlobalMetaId: string) => void
  walletConnected: boolean
}

function previewText(content: string): string {
  const oneLine = content.replace(/\s+/g, ' ').trim()
  if (oneLine.length <= 80) return oneLine
  return `${oneLine.slice(0, 77)}…`
}

export function SessionsList({
  sessions,
  selectedPeerGlobalMetaId,
  onSelectPeer,
  walletConnected,
}: SessionsListProps) {
  if (!walletConnected) {
    return (
      <div className="rounded-card border border-dashed border-hub-border bg-hub-surface/40 p-4 text-sm text-hub-muted">
        Connect your Metalet wallet to receive private chat over Socket.IO.
      </div>
    )
  }

  if (sessions.length === 0) {
    return (
      <div className="rounded-card border border-dashed border-hub-border bg-hub-surface/40 p-4 text-sm text-hub-muted">
        No sessions yet. Incoming simplemsg notifications will appear here.
      </div>
    )
  }

  return (
    <ul className="flex flex-col gap-1" aria-label="Delivery sessions">
      {sessions.map((session) => {
        const selected = session.peerGlobalMetaId === selectedPeerGlobalMetaId
        return (
          <li key={session.peerGlobalMetaId}>
            <button
              type="button"
              onClick={() => onSelectPeer(session.peerGlobalMetaId)}
              className={clsx(
                'w-full rounded-card border px-3 py-3 text-left transition-colors',
                selected
                  ? 'border-hub-accent/60 bg-hub-surface2'
                  : 'border-hub-border bg-hub-surface/60 hover:border-hub-muted/50',
              )}
            >
              <div className="font-semibold text-white">
                {truncateGlobalMetaId(session.peerGlobalMetaId)}
              </div>
              <p className="mt-1 line-clamp-2 text-xs text-hub-muted">
                {previewText(session.lastMessage.content)}
              </p>
              <p className="mt-1 text-[11px] text-hub-muted">
                {session.messageCount} message{session.messageCount === 1 ? '' : 's'}
              </p>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
