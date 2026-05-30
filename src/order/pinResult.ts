const PIN_ID_PATTERN = /([0-9a-fA-F]{64})i(\d+)/i
const TXID_PATTERN = /[0-9a-fA-F]{64}/

const PIN_ID_KEYS = ['pinId', 'pinid']
const CREATE_PIN_FAILURE_KEYS = ['status', 'code', 'message', 'reason']
const CREATE_PIN_NESTED_KEYS = ['data', 'result', 'raw', 'payload', 'res', 'response']
const CREATE_PIN_FAILURE_RE =
  /\b(cancell?ed|fail(?:ed|ure)?|error|reject(?:ed)?|den(?:ied|y)|locked|not[-_\s]?connected|not[-_\s]?logged[-_\s]?in|no[-_\s]?wallets?|insufficient)\b/i
const CREATE_PIN_SUCCESS_RE = /\b(task\s*finished|finished|success|ok|done)\b/i
const CREATE_PIN_RESPONSE_LOST_RE =
  /\b(message\s+(?:channel|port)\s+closed|asynchronous\s+response\b.*\bresponse\s+was\s+received)\b/i
const CREATE_PIN_TIMEOUT_RE = /\b(time(?:d)?\s*out|timeout)\b/i
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
  'url',
  'URL',
  'openUrl',
  'openURL',
  'open-url',
  'explorer',
  'explorerUrl',
  'explorerURL',
  'txUrl',
  'txURL',
]
const URL_TXID_KEYS = new Set([
  'url',
  'URL',
  'openUrl',
  'openURL',
  'open-url',
  'explorer',
  'explorerUrl',
  'explorerURL',
  'txUrl',
  'txURL',
])
const NESTED_KEYS = ['data', 'result', 'raw', 'payload', 'error']

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
      collectCandidates(record[key], keys, out, !URL_TXID_KEYS.has(key))
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

function formatFailureValue(value: unknown): string {
  if (value instanceof Error) return value.message || value.name
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number' || typeof value === 'bigint') return String(value)
  if (typeof value === 'boolean') return value ? 'true' : ''
  if (!value || typeof value !== 'object') return ''

  const record = value as Record<string, unknown>
  for (const key of ['message', 'reason', 'code', 'status']) {
    const nested = formatFailureValue(record[key])
    if (nested) return nested
  }
  for (const key of URL_TXID_KEYS) {
    if (typeof record[key] === 'string' && record[key].trim()) return ''
  }
  return Object.keys(record).length ? 'Wallet createPin returned an error.' : ''
}

function isFailureText(value: string): boolean {
  if (!value) return false
  if (CREATE_PIN_SUCCESS_RE.test(value) && !CREATE_PIN_FAILURE_RE.test(value)) return false
  return CREATE_PIN_FAILURE_RE.test(value)
}

function findResolvedCreatePinFailureMessage(
  result: unknown,
  seen: WeakSet<object>,
): string {
  if (!result || typeof result !== 'object') return ''
  if (seen.has(result)) return ''
  seen.add(result)

  if (Array.isArray(result)) {
    for (const item of result) {
      const failure = findResolvedCreatePinFailureMessage(item, seen)
      if (failure) return failure
    }
    return ''
  }

  const record = result as Record<string, unknown>
  if ('error' in record) {
    const failure = formatFailureValue(record.error)
    if (isFailureText(failure)) return failure
  }

  const message = formatFailureValue(record.message)
  for (const key of CREATE_PIN_FAILURE_KEYS) {
    const value = formatFailureValue(record[key])
    if (!isFailureText(value)) continue
    if (key !== 'message' && isFailureText(message)) return message
    return value
  }

  for (const key of CREATE_PIN_NESTED_KEYS) {
    if (key in record) {
      const failure = findResolvedCreatePinFailureMessage(record[key], seen)
      if (failure) return failure
    }
  }
  return ''
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

export function getResolvedCreatePinFailureMessage(result: unknown): string {
  if (resolvePrimaryPinId(result)) return ''
  return findResolvedCreatePinFailureMessage(result, new WeakSet())
}

export function isCreatePinTransportResponseLostError(err: unknown): boolean {
  const message = formatFailureValue(err)
  if (!message || CREATE_PIN_TIMEOUT_RE.test(message)) return false
  if (!CREATE_PIN_RESPONSE_LOST_RE.test(message)) return false

  const explicitFailureText = message
    .replace(/runtime\.lastError/gi, '')
    .replace(CREATE_PIN_RESPONSE_LOST_RE, '')
  return !isFailureText(explicitFailureText)
}
