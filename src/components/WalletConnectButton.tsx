import { useEffect, useState } from 'react'
import { DocumentDuplicateIcon } from '@heroicons/react/24/outline'
import { t } from '@/i18n'
import { useWallet } from '@/wallet/useWallet'
import { truncateGlobalMetaId } from '@/wallet/format'
import { MetaletNotInstalledError } from '@/wallet/metalet'
import { avatarColor, avatarInitials } from '@/lib/avatar'
import { resolveWalletAvatarUrl } from '@/wallet/avatar'

export function WalletConnectButton() {
  const { identity, status, errorMessage, connect, disconnect } = useWallet()
  const [avatarFailed, setAvatarFailed] = useState(false)
  const avatarResetKey = identity
    ? `${identity.globalMetaId}:${identity.avatarUrl ?? ''}:${identity.avatar ?? ''}:${identity.avatarId ?? ''}:${identity.avatarPinId ?? ''}`
    : ''

  useEffect(() => {
    setAvatarFailed(false)
  }, [avatarResetKey])

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
    const displayName = identity.name?.trim() || truncateGlobalMetaId(identity.globalMetaId)
    const shortGlobalMetaId = truncateGlobalMetaId(identity.globalMetaId)
    const initials = avatarInitials(displayName)
    const bgColor = avatarColor(displayName)
    const avatarSrc = resolveWalletAvatarUrl(identity)

    const handleCopyGlobalMetaId = () => {
      if (!navigator.clipboard?.writeText) return
      void navigator.clipboard.writeText(identity.globalMetaId).catch(() => undefined)
    }

    return (
      <div className="flex items-center gap-3">
        <div className="flex min-w-0 items-center gap-2">
          {avatarSrc && !avatarFailed ? (
            <img
              src={avatarSrc}
              alt={`${displayName} avatar`}
              onError={() => setAvatarFailed(true)}
              className="h-8 w-8 shrink-0 rounded-full border border-hub-border object-cover"
            />
          ) : (
            <span
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-white/90"
              aria-label={`${displayName} avatar`}
              style={{ backgroundColor: bgColor }}
            >
              {initials}
            </span>
          )}
          <span className="hidden min-w-0 flex-col sm:flex">
            <span className="max-w-[140px] truncate text-sm font-medium text-white">
              {displayName}
            </span>
            <span className="flex min-w-0 items-center gap-1">
              <span
                className="min-w-0 truncate font-mono text-xs text-hub-muted"
                title={identity.globalMetaId}
              >
                {shortGlobalMetaId}
              </span>
              <button
                type="button"
                onClick={handleCopyGlobalMetaId}
                aria-label={t('wallet.copyGlobalMetaId')}
                title={t('wallet.copyGlobalMetaId')}
                className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-hub-muted transition-colors hover:bg-white/10 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hub-accent"
              >
                <DocumentDuplicateIcon className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </span>
          </span>
        </div>
        <button
          type="button"
          onClick={() => void disconnect()}
          className="rounded-lg border border-hub-border bg-hub-surface2 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:border-hub-accent/40 hover:bg-hub-accent/10"
        >
          {t('wallet.disconnect')}
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
        {status === 'connecting' ? t('wallet.connecting') : t('wallet.connect')}
      </button>
      {status === 'error' && errorMessage ? (
        <span className="max-w-[200px] truncate text-xs text-red-400">
          {t('wallet.connectFailed')}
        </span>
      ) : null}
    </div>
  )
}
