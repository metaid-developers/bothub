const PIN_ID_PATTERN = /([0-9a-fA-F]{64})i(\d+)/i
const TXID_PATTERN = /[0-9a-fA-F]{64}/

const PIN_ID_KEYS = ['pinId', 'pinid']
const TXID_KEYS = [
  'txid',
  'txId',
  'hash',
  'id',
  'pinTxId',
  'transactionId',
  'txids',
  'txIds',
  'revealTxId',
  'revealTxid',
  'revealTxIds',
  'res',
  'transactions',
]
const NESTED_KEYS = ['data', 'result', 'raw', 'payload']

function collectStringCandidate(value: string, out: string[], allowFallback: boolean): void {
  const trimmed = value.trim()
  if (!trimmed) return

  const pinId = trimmed.match(PIN_ID_PATTERN)
  if (pinId) {
    out.push(`${pinId[1].toLowerCase()}i${pinId[2]}`)
    return
  }

  const txid = trimmed.match(TXID_PATTERN)
  if (txid) {
    out.push(txid[0].toLowerCase())
  } else if (allowFallback) {
    out.push(trimmed)
  }
}

function collectCandidates(
  value: unknown,
  keys: string[],
  out: string[] = [],
  allowFallback = true,
): string[] {
  if (typeof value === 'string') {
    collectStringCandidate(value, out, allowFallback)
    return out
  }
  if (!value || typeof value !== 'object') return out

  if (Array.isArray(value)) {
    for (const item of value) {
      collectCandidates(item, keys, out, allowFallback)
    }
    return out
  }

  const record = value as Record<string, unknown>
  for (const key of keys) {
    if (key in record) {
      collectCandidates(record[key], keys, out, true)
    }
  }
  for (const key of NESTED_KEYS) {
    if (key in record) {
      collectCandidates(record[key], keys, out, false)
    }
  }
  return out
}

function normalizeSimplemsgPinId(candidate: string): string {
  const trimmed = candidate.trim()
  if (!trimmed) return ''

  const pinId = trimmed.match(PIN_ID_PATTERN)
  if (pinId) return `${pinId[1].toLowerCase()}i${pinId[2]}`

  const txid = trimmed.match(TXID_PATTERN)
  if (txid) return `${txid[0].toLowerCase()}i0`

  return trimmed
}

export function collectTxidLikeStrings(result: unknown): string[] {
  return collectCandidates(result, TXID_KEYS)
}

export function resolvePrimaryPinId(result: unknown): string {
  const explicitPinId = collectCandidates(result, PIN_ID_KEYS)[0]
  if (explicitPinId) return normalizeSimplemsgPinId(explicitPinId)

  const txid = collectTxidLikeStrings(result)[0]
  return txid ? normalizeSimplemsgPinId(txid) : ''
}
