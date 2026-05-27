import { useWallet } from '@/wallet/useWallet'
import { truncateGlobalMetaId } from '@/wallet/format'
import { MetaletNotInstalledError } from '@/wallet/metalet'

export function WalletConnectButton() {
  const { identity, status, errorMessage, connect, disconnect } = useWallet()

  const handleConnect = async () => {
    try {
      await connect()
    } catch (err) {
      if (err instanceof MetaletNotInstalledError) {
        window.open('https://metalet.space/', '_blank', 'noopener,noreferrer')
      }
    }
  }

  if (status === 'connected' && identity) {
    return (
      <div className="flex items-center gap-2">
        <span
          className="hidden font-mono text-xs text-hub-muted sm:inline"
          title={identity.globalMetaId}
        >
          {truncateGlobalMetaId(identity.globalMetaId)}
        </span>
        <button
          type="button"
          onClick={() => void disconnect()}
          className="rounded-lg border border-hub-border bg-hub-surface2 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:border-hub-accent/40 hover:bg-hub-accent/10"
        >
          断开
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={() => void handleConnect()}
        disabled={status === 'connecting'}
        className="rounded-lg bg-hub-accent px-4 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-hub-accent-hover disabled:opacity-60"
      >
        {status === 'connecting' ? '连接中…' : '连接钱包'}
      </button>
      {status === 'error' && errorMessage ? (
        <span className="max-w-[200px] truncate text-xs text-red-400" title={errorMessage}>
          {errorMessage}
        </span>
      ) : null}
    </div>
  )
}
