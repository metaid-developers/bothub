import { Dialog } from '@headlessui/react'
import { clsx } from 'clsx'
import { useCallback, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { ProviderInfo, SkillServiceCore } from '@/api/aggregator.types'
import { useMessageStore } from '@/delivery/messageStore'
import { persistFailedToSendOrder, persistPendingOrder } from '@/delivery/orderStore'
import { formatPrice } from '@/lib/format'
import {
  buildDeliveryOrderPath,
  buildDeliverySessionPath,
  executePayAndRequest,
  getLastCreatePinDiagnostic,
  isFreeServicePrice,
  PayAndRequestBroadcastError,
  PayAndRequestError,
} from '@/order/flow'
import { ORDER_RAW_REQUEST_MAX_CHARS } from '@/order/orderMessage'
import { t } from '@/i18n'
import * as metalet from '@/wallet/metalet'
import type { WalletIdentity } from '@/wallet/types'
import { useWallet } from '@/wallet/useWallet'

export type RequestModalStep =
  | 'prompt'
  | 'confirm'
  | 'checking_wallet'
  | 'paying'
  | 'encrypting'
  | 'broadcasting'
  | 'done'
  | 'error'

export interface RequestModalProps {
  open: boolean
  onClose: () => void
  service: SkillServiceCore
  provider: ProviderInfo
  wallet: WalletIdentity | null
}

const MRC20_CHECKOUT_UNSUPPORTED_MESSAGE = () => t('hub.request.mrc20Unsupported')

export function RequestModal({ open, onClose, service, provider, wallet }: RequestModalProps) {
  const navigate = useNavigate()
  const [prompt, setPrompt] = useState('')
  const [step, setStep] = useState<RequestModalStep>('prompt')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [recoverableDeliveryPath, setRecoverableDeliveryPath] = useState<string | null>(null)
  const [retryDisabled, setRetryDisabled] = useState(false)
  const [createPinDiagnosticJson, setCreatePinDiagnosticJson] = useState<string | null>(null)

  const price = useMemo(() => formatPrice(service.price, service.currency), [service])
  const providerName = provider.name?.trim() || t('hub.unknownBot')
  const promptTooLong = prompt.length > ORDER_RAW_REQUEST_MAX_CHARS
  const promptEmpty = prompt.trim().length === 0

  const resetAndClose = useCallback(() => {
    setPrompt('')
    setStep('prompt')
    setErrorMessage(null)
    setRecoverableDeliveryPath(null)
    setRetryDisabled(false)
    setCreatePinDiagnosticJson(null)
    onClose()
  }, [onClose])

  const handleConfirm = async () => {
    setErrorMessage(null)
    setRecoverableDeliveryPath(null)
    setRetryDisabled(false)
    setCreatePinDiagnosticJson(null)
    if (!wallet?.globalMetaId?.trim()) {
      setErrorMessage(t('hub.request.walletRequired'))
      setStep('error')
      return
    }
    if (!provider.chatPubkey?.trim()) {
      setErrorMessage(t('hub.request.providerUnavailable'))
      setStep('error')
      return
    }
    const isFree = isFreeServicePrice(service.price)
    if (!isFree && service.settlementKind === 'mrc20') {
      setErrorMessage(MRC20_CHECKOUT_UNSUPPORTED_MESSAGE())
      setStep('error')
      return
    }
    try {
      setStep('checking_wallet')
      await metalet.ensureReady(wallet.globalMetaId)
      setStep(isFree ? 'encrypting' : 'paying')

      const result = await executePayAndRequest({
        service,
        provider,
        prompt,
        wallet,
        metalet: {
          transfer: async (params) => {
            setStep('paying')
            const transferResult = await metalet.transfer(params)
            setStep('encrypting')
            return transferResult
          },
          ecdh: async (params) => {
            setStep('encrypting')
            return metalet.ecdh(params)
          },
          createPin: async (params) => {
            setStep('broadcasting')
            return metalet.createPin(params)
          },
        },
      })

      let deliveryPath = buildDeliverySessionPath(result.sessionKey)
      try {
        const persisted = await persistPendingOrder({ wallet, service, provider, prompt, result })
        deliveryPath = buildDeliveryOrderPath(persisted.order)
        try {
          await useMessageStore.getState().hydrateFromDb(wallet.globalMetaId)
        } catch (hydrateError) {
          console.warn('Order was saved locally but could not hydrate Delivery.', hydrateError)
        }
      } catch (persistError) {
        console.warn('Order was sent but could not be saved locally.', persistError)
      }

      setStep('done')
      navigate(deliveryPath)
      resetAndClose()
    } catch (err) {
      if (err instanceof PayAndRequestBroadcastError) {
        const diagnostic = import.meta.env.DEV ? getLastCreatePinDiagnostic() : null
        setCreatePinDiagnosticJson(diagnostic ? JSON.stringify(diagnostic, null, 2) : null)
        let deliveryPath: string | null = null
        let savedForRecovery = false
        try {
          const persisted = await persistFailedToSendOrder({
            wallet,
            service,
            provider,
            prompt,
            partial: err.partial,
          })
          deliveryPath = buildDeliveryOrderPath(persisted.order)
          savedForRecovery = true
          try {
            await useMessageStore.getState().hydrateFromDb(wallet.globalMetaId)
          } catch (hydrateError) {
            console.warn(
              'Failed order was saved locally but could not hydrate Delivery.',
              hydrateError,
            )
          }
        } catch (persistError) {
          console.warn('Failed order could not be saved locally.', persistError)
        }
        setRecoverableDeliveryPath(deliveryPath)
        const paidTxid = err.partial.payment.paymentTxid.trim()
        setRetryDisabled(Boolean(paidTxid) && !savedForRecovery)
        const message = savedForRecovery
          ? paidTxid
            ? t('hub.request.paidSaved')
            : t('hub.request.freeSaved')
          : paidTxid
            ? t('hub.request.paidNotSaved', { txid: paidTxid })
            : t('hub.request.freeNotSaved')
        setErrorMessage(message)
        setStep('error')
        return
      }
      const message =
        err instanceof PayAndRequestError ? t('hub.request.incomplete') : t('hub.request.failed')
      const walletStore = useWallet.getState()
      if (walletStore.isWalletReadinessError(err)) {
        walletStore.clearStaleConnection()
        setErrorMessage(t('hub.request.staleWallet'))
        setStep('error')
        return
      }
      setErrorMessage(message)
      setStep('error')
    }
  }

  const busy =
    step === 'checking_wallet' ||
    step === 'paying' ||
    step === 'encrypting' ||
    step === 'broadcasting'

  return (
    <Dialog open={open} onClose={busy ? () => undefined : resetAndClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/60" aria-hidden />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className="w-full max-w-lg rounded-card border border-hub-border bg-hub-surface p-5 shadow-xl">
          <Dialog.Title className="font-display text-lg font-semibold text-white">
            {t('hub.request.title')}
          </Dialog.Title>
          <p className="mt-1 text-sm text-hub-muted">{service.displayName}</p>

          {step === 'prompt' ? (
            <div className="mt-4 space-y-3">
              <label className="block text-sm text-hub-muted" htmlFor="request-prompt">
                {t('hub.request.promptLabel')}
              </label>
              <textarea
                id="request-prompt"
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                maxLength={ORDER_RAW_REQUEST_MAX_CHARS}
                rows={6}
                className="w-full resize-y rounded-xl border border-hub-border bg-hub-surface2 px-3 py-2 text-sm text-white placeholder:text-hub-muted/60 focus:border-hub-accent focus:outline-none"
                placeholder={t('hub.request.promptPlaceholder')}
              />
              <p
                className={clsx(
                  'text-right text-xs',
                  promptTooLong ? 'text-red-300' : 'text-hub-muted',
                )}
              >
                {prompt.length} / {ORDER_RAW_REQUEST_MAX_CHARS}
              </p>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={resetAndClose}
                  className="rounded-lg px-3 py-2 text-sm text-hub-muted hover:bg-hub-surface2"
                >
                  {t('hub.request.cancel')}
                </button>
                <button
                  type="button"
                  disabled={promptEmpty || promptTooLong}
                  onClick={() => setStep('confirm')}
                  className="rounded-lg bg-hub-accent px-4 py-2 text-sm font-semibold text-hub-bg disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {t('hub.request.reviewOrder')}
                </button>
              </div>
            </div>
          ) : null}

          {step === 'confirm' ? (
            <div className="mt-4 space-y-4">
              <dl className="space-y-2 rounded-xl border border-hub-border/80 bg-hub-surface2/50 p-3 text-sm">
                <div className="flex justify-between gap-2">
                  <dt className="text-hub-muted">{t('hub.provider')}</dt>
                  <dd className="font-medium text-white">{providerName}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-hub-muted">{t('hub.price')}</dt>
                  <dd className="font-semibold text-hub-accent">
                    {price.amount}
                    {price.currency ? (
                      <>
                        {' '}
                        <span className="text-xs uppercase text-hub-muted">{price.currency}</span>
                      </>
                    ) : null}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-hub-muted">{t('hub.settlement')}</dt>
                  <dd className="text-white">
                    {service.settlementKind === 'native' ? t('hub.nativeCoin') : 'MRC20'}
                  </dd>
                </div>
              </dl>
              <p className="rounded-lg bg-hub-surface2/80 p-3 text-sm text-hub-muted whitespace-pre-wrap">
                {prompt.trim()}
              </p>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setStep('prompt')}
                  className="rounded-lg px-3 py-2 text-sm text-hub-muted hover:bg-hub-surface2"
                >
                  {t('hub.request.back')}
                </button>
                <button
                  type="button"
                  onClick={() => void handleConfirm()}
                  className="rounded-lg bg-hub-accent px-4 py-2 text-sm font-semibold text-hub-bg"
                >
                  {t('hub.request.confirm')}
                </button>
              </div>
            </div>
          ) : null}

          {busy ? (
            <div className="mt-6 space-y-2 text-sm" aria-live="polite">
              <ProgressRow
                label={t('hub.request.checkWallet')}
                active={step === 'checking_wallet'}
                done={step === 'paying' || step === 'encrypting' || step === 'broadcasting'}
              />
              {!isFreeServicePrice(service.price) ? (
                <ProgressRow
                  label={t('hub.request.payment')}
                  active={step === 'paying'}
                  done={step === 'encrypting' || step === 'broadcasting'}
                />
              ) : null}
              <ProgressRow
                label={t('hub.request.encrypt')}
                active={step === 'encrypting'}
                done={step === 'broadcasting'}
              />
              <ProgressRow
                label={t('hub.request.broadcast')}
                active={step === 'broadcasting'}
                done={false}
              />
            </div>
          ) : null}

          {step === 'done' ? (
            <p className="mt-4 text-sm text-hub-accent">{t('hub.request.sentRedirect')}</p>
          ) : null}

          {step === 'error' ? (
            <div className="mt-4 space-y-3">
              <p className="rounded-lg border border-red-500/40 bg-red-950/30 px-3 py-2 text-sm text-red-200">
                {errorMessage}
              </p>
              {createPinDiagnosticJson ? (
                <details className="rounded-lg border border-hub-border bg-hub-surface2/70 px-3 py-2 text-xs text-hub-muted">
                  <summary className="cursor-pointer text-hub-accent">
                    {t('hub.request.diagnostics')}
                  </summary>
                  <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-words">
                    {createPinDiagnosticJson}
                  </pre>
                </details>
              ) : null}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={resetAndClose}
                  className="rounded-lg px-3 py-2 text-sm text-hub-muted hover:bg-hub-surface2"
                >
                  {t('hub.request.close')}
                </button>
                <button
                  type="button"
                  onClick={() => setStep('confirm')}
                  disabled={Boolean(recoverableDeliveryPath) || retryDisabled}
                  className="rounded-lg bg-hub-accent px-4 py-2 text-sm font-semibold text-hub-bg"
                >
                  {recoverableDeliveryPath
                    ? t('hub.request.savedToDelivery')
                    : retryDisabled
                      ? t('hub.request.cannotSaveRecovery')
                      : t('hub.request.retry')}
                </button>
                {recoverableDeliveryPath ? (
                  <button
                    type="button"
                    onClick={() => navigate(recoverableDeliveryPath)}
                    className="rounded-lg bg-hub-accent px-4 py-2 text-sm font-semibold text-hub-bg"
                  >
                    {t('hub.request.openDelivery')}
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}
        </Dialog.Panel>
      </div>
    </Dialog>
  )
}

function ProgressRow({ label, active, done }: { label: string; active: boolean; done: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <span
        className={clsx(
          'h-2 w-2 rounded-full',
          done ? 'bg-hub-accent' : active ? 'animate-pulse bg-hub-accent' : 'bg-hub-border',
        )}
        aria-hidden
      />
      <span className={active ? 'text-white' : 'text-hub-muted'}>{label}</span>
    </div>
  )
}
