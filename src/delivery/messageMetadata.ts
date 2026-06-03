import type { DeliveryMessage } from '@/delivery/messageStore'

const TXID_RE = /^[0-9a-f]{64}$/i
const PIN_ID_TXID_RE = /^([0-9a-f]{64})i\d+$/i

function normalizeTxIdCandidate(value: unknown): string {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : ''
  return TXID_RE.test(normalized) ? normalized : ''
}

function normalizePinIdCandidate(value: unknown): string {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : ''
  const match = normalized.match(PIN_ID_TXID_RE)
  return match?.[1] ?? ''
}

export function resolveDeliveryMessageTxId(message: DeliveryMessage): string {
  return normalizeTxIdCandidate(message.txId) || normalizePinIdCandidate(message.pinId)
}

export function formatDeliveryTxIdPreview(txid: string): string {
  const normalized = normalizeTxIdCandidate(txid)
  if (!normalized) return ''
  return `${normalized.slice(0, 8)}......${normalized.slice(-6)}`
}

export function formatDeliveryMessageTime(timestamp: number): string {
  if (!Number.isFinite(timestamp) || timestamp <= 0) return ''
  const date = new Date(timestamp)
  if (Number.isNaN(date.getTime())) return ''
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${hours}:${minutes}`
}
