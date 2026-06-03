import { Dialog } from '@headlessui/react'
import { clsx } from 'clsx'
import { useCallback, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { ProviderInfo, SkillServiceCore } from '@/api/aggregator.types'
import { useMessageStore } from '@/delivery/messageStore'
import {
  persistFailedToSendOrder,
  persistPendingOrder,
} from '@/delivery/orderStore'
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

const MRC20_CHECKOUT_UNSUPPORTED_MESSAGE =
  '暂不支持 MRC20 服务下单，请选择原生币或免费服务。'

export function RequestModal({ open, onClose, service, provider, wallet }: RequestModalProps) {
  const navigate = useNavigate()
  const [prompt, setPrompt] = useState('')
  const [step, setStep] = useState<RequestModalStep>('prompt')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [recoverableDeliveryPath, setRecoverableDeliveryPath] = useState<string | null>(null)
  const [retryDisabled, setRetryDisabled] = useState(false)
  const [createPinDiagnosticJson, setCreatePinDiagnosticJson] = useState<string | null>(null)

  const price = useMemo(() => formatPrice(service.price, service.currency), [service])
  const providerName = provider.name?.trim() || '未知服务方'
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
      setErrorMessage('连接 Metalet 钱包后即可下单。')
      setStep('error')
      return
    }
    if (!provider.chatPubkey?.trim()) {
      setErrorMessage('服务方暂时无法接单，请稍后再试或选择其他服务。')
      setStep('error')
      return
    }
    const isFree = isFreeServicePrice(service.price)
    if (!isFree && service.settlementKind === 'mrc20') {
      setErrorMessage(MRC20_CHECKOUT_UNSUPPORTED_MESSAGE)
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
            console.warn('Failed order was saved locally but could not hydrate Delivery.', hydrateError)
          }
        } catch (persistError) {
          console.warn('Failed order could not be saved locally.', persistError)
        }
        setRecoverableDeliveryPath(deliveryPath)
        const paidTxid = err.partial.payment.paymentTxid.trim()
        setRetryDisabled(Boolean(paidTxid) && !savedForRecovery)
        const message = savedForRecovery
          ? paidTxid
            ? '付款已完成，但请求消息未成功发送。已在我的交付中保存，可继续处理。'
            : '免费请求暂时发送失败，已在我的交付中保存，可继续处理。'
          : paidTxid
            ? `付款已完成，但请求消息未成功发送，本地恢复记录也未能保存。支付参考：${paidTxid}`
            : '免费请求暂时发送失败，且无法保存到我的交付。请稍后重试。'
        setErrorMessage(
          message,
        )
        setStep('error')
        return
      }
      const message =
        err instanceof PayAndRequestError
          ? '下单前信息不完整，请换一个服务或稍后再试。'
          : '下单失败，请稍后重试。'
      const walletStore = useWallet.getState()
      if (walletStore.isWalletReadinessError(err)) {
        walletStore.clearStaleConnection()
        setErrorMessage('钱包连接已失效，请重新连接 Metalet 后再下单。')
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
            下单请求
          </Dialog.Title>
          <p className="mt-1 text-sm text-hub-muted">{service.displayName}</p>

          {step === 'prompt' ? (
            <div className="mt-4 space-y-3">
              <label className="block text-sm text-hub-muted" htmlFor="request-prompt">
                填写你的需求
              </label>
              <textarea
                id="request-prompt"
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                maxLength={ORDER_RAW_REQUEST_MAX_CHARS}
                rows={6}
                className="w-full resize-y rounded-xl border border-hub-border bg-hub-surface2 px-3 py-2 text-sm text-white placeholder:text-hub-muted/60 focus:border-hub-accent focus:outline-none"
                placeholder="请描述你想让服务方完成的任务"
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
                  取消
                </button>
                <button
                  type="button"
                  disabled={promptEmpty || promptTooLong}
                  onClick={() => setStep('confirm')}
                  className="rounded-lg bg-hub-accent px-4 py-2 text-sm font-semibold text-hub-bg disabled:cursor-not-allowed disabled:opacity-50"
                >
                  检查订单
                </button>
              </div>
            </div>
          ) : null}

          {step === 'confirm' ? (
            <div className="mt-4 space-y-4">
              <dl className="space-y-2 rounded-xl border border-hub-border/80 bg-hub-surface2/50 p-3 text-sm">
                <div className="flex justify-between gap-2">
                  <dt className="text-hub-muted">服务方</dt>
                  <dd className="font-medium text-white">{providerName}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-hub-muted">价格</dt>
                  <dd className="font-semibold text-hub-accent">
                    {price.amount}{' '}
                    <span className="text-xs uppercase text-hub-muted">{price.currency}</span>
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-hub-muted">结算方式</dt>
                  <dd className="text-white">
                    {service.settlementKind === 'native' ? '原生币' : 'MRC20'}
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
                  返回修改
                </button>
                <button
                  type="button"
                  onClick={() => void handleConfirm()}
                  className="rounded-lg bg-hub-accent px-4 py-2 text-sm font-semibold text-hub-bg"
                >
                  确认并下单
                </button>
              </div>
            </div>
          ) : null}

          {busy ? (
            <div className="mt-6 space-y-2 text-sm" aria-live="polite">
              <ProgressRow
                label="检查钱包"
                active={step === 'checking_wallet'}
                done={step === 'paying' || step === 'encrypting' || step === 'broadcasting'}
              />
              {service.price !== '0' ? (
                <ProgressRow
                  label="付款"
                  active={step === 'paying'}
                  done={step === 'encrypting' || step === 'broadcasting'}
                />
              ) : null}
              <ProgressRow
                label="加密请求"
                active={step === 'encrypting'}
                done={step === 'broadcasting'}
              />
              <ProgressRow
                label="写入链上"
                active={step === 'broadcasting'}
                done={false}
              />
            </div>
          ) : null}

          {step === 'done' ? (
            <p className="mt-4 text-sm text-hub-accent">请求已发送，正在打开我的交付…</p>
          ) : null}

          {step === 'error' ? (
            <div className="mt-4 space-y-3">
              <p className="rounded-lg border border-red-500/40 bg-red-950/30 px-3 py-2 text-sm text-red-200">
                {errorMessage}
              </p>
              {createPinDiagnosticJson ? (
                <details className="rounded-lg border border-hub-border bg-hub-surface2/70 px-3 py-2 text-xs text-hub-muted">
                  <summary className="cursor-pointer text-hub-accent">
                    发单诊断详情
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
                  关闭
                </button>
                <button
                  type="button"
                  onClick={() => setStep('confirm')}
                  disabled={Boolean(recoverableDeliveryPath) || retryDisabled}
                  className="rounded-lg bg-hub-accent px-4 py-2 text-sm font-semibold text-hub-bg"
                >
                  {recoverableDeliveryPath
                    ? '已保存到我的交付'
                    : retryDisabled
                      ? '无法保存恢复记录'
                      : '再试一次'}
                </button>
                {recoverableDeliveryPath ? (
                  <button
                    type="button"
                    onClick={() => navigate(recoverableDeliveryPath)}
                    className="rounded-lg bg-hub-accent px-4 py-2 text-sm font-semibold text-hub-bg"
                  >
                    打开我的交付
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

function ProgressRow({
  label,
  active,
  done,
}: {
  label: string
  active: boolean
  done: boolean
}) {
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
