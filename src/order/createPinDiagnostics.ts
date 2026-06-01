import {
  collectTxidLikeStrings,
  getResolvedCreatePinFailureMessage,
  resolvePrimaryPinId,
} from './pinResult'

export const CREATE_PIN_DIAGNOSTICS_STORAGE_KEY = 'bothub:createPinDiagnostics'

const MAX_DIAGNOSTICS = 10
const MAX_MESSAGE_CHARS = 240
const MAX_KEYS = 24
const MAX_ARRAY_ITEMS = 4
const MAX_DEPTH = 3

const SENSITIVE_KEY_RE =
  /body|content|payload|prompt|request|secret|cipher|encrypt|chatpubkey|pubkey|private|simplemsg|datalist|metaiddata/i

export type CreatePinDiagnosticPhase =
  | 'resolved'
  | 'rejected'
  | 'response_lost'
  | 'failure_envelope'
  | 'success_pin'
  | 'indeterminate_success'

export interface CreatePinDiagnosticContext {
  service: {
    id?: string
    serviceName?: string
    displayName?: string
    providerSkill?: string | null
  }
  provider: {
    globalMetaId?: string
    name?: string | null
  }
  payment: {
    paymentTxid?: string
    orderReference?: string
  }
  sessionKey?: string
}

export interface CreatePinDiagnostic {
  at: string
  phase: CreatePinDiagnosticPhase
  serviceId: string
  serviceName: string
  providerGlobalMetaId: string
  providerName: string
  paymentTxid: string
  orderReference: string
  sessionKey: string
  resolvedPinId: string
  failureMessage: string
  errorName: string
  errorMessage: string
  txidCandidates: string[]
  resultShape: unknown
}

export interface BuildCreatePinDiagnosticInput {
  phase: CreatePinDiagnosticPhase
  context: CreatePinDiagnosticContext
  result?: unknown
  error?: unknown
  resolvedPinId?: string
  failureMessage?: string
}

declare global {
  interface Window {
    __bothubLastCreatePinDiagnostic?: CreatePinDiagnostic
  }
}

type ShapeSummary =
  | { type: 'null' }
  | { type: 'undefined' }
  | { type: 'string'; length: number }
  | { type: 'number' | 'boolean' | 'bigint'; value: string }
  | { type: 'function' | 'symbol' }
  | { type: 'array'; length: number; items: ShapeSummary[] }
  | { type: 'object'; keys: string[]; fields?: Record<string, ShapeSummary | { redacted: true; type: string }> }

function trimMessage(value: string): string {
  return value.trim().slice(0, MAX_MESSAGE_CHARS)
}

function describeType(value: unknown): string {
  if (value === null) return 'null'
  if (Array.isArray(value)) return 'array'
  return typeof value
}

function summarizeUnknown(
  value: unknown,
  seen = new WeakSet<object>(),
  depth = 0,
): ShapeSummary {
  if (value === null) return { type: 'null' }
  if (typeof value === 'undefined') return { type: 'undefined' }
  if (typeof value === 'string') return { type: 'string', length: value.length }
  if (typeof value === 'number') return { type: 'number', value: String(value) }
  if (typeof value === 'boolean') return { type: 'boolean', value: String(value) }
  if (typeof value === 'bigint') return { type: 'bigint', value: String(value) }
  if (typeof value === 'function') return { type: 'function' }
  if (typeof value === 'symbol') return { type: 'symbol' }
  if (typeof value !== 'object') return { type: 'undefined' }
  if (seen.has(value)) return { type: 'object', keys: ['[Circular]'] }
  seen.add(value)

  if (Array.isArray(value)) {
    return {
      type: 'array',
      length: value.length,
      items: value.slice(0, MAX_ARRAY_ITEMS).map((item) => summarizeUnknown(item, seen, depth + 1)),
    }
  }

  const record = value as Record<string, unknown>
  const keys = Object.keys(record).slice(0, MAX_KEYS)
  if (depth >= MAX_DEPTH) return { type: 'object', keys }

  const fields: Record<string, ShapeSummary | { redacted: true; type: string }> = {}
  for (const key of keys) {
    if (SENSITIVE_KEY_RE.test(key)) {
      fields[key] = { redacted: true, type: describeType(record[key]) }
    } else {
      fields[key] = summarizeUnknown(record[key], seen, depth + 1)
    }
  }
  return { type: 'object', keys, fields }
}

function extractErrorName(error: unknown): string {
  if (error instanceof Error) return error.name
  if (!error || typeof error !== 'object') return ''
  const name = (error as Record<string, unknown>).name
  return typeof name === 'string' ? trimMessage(name) : ''
}

function extractErrorMessage(error: unknown): string {
  if (error instanceof Error) return trimMessage(error.message)
  if (typeof error === 'string') return trimMessage(error)
  if (!error || typeof error !== 'object') return ''
  const message = (error as Record<string, unknown>).message
  return typeof message === 'string' ? trimMessage(message) : ''
}

export function buildCreatePinDiagnostic({
  phase,
  context,
  result,
  error,
  resolvedPinId,
  failureMessage,
}: BuildCreatePinDiagnosticInput): CreatePinDiagnostic {
  const pinId = resolvedPinId ?? resolvePrimaryPinId(result)
  const failure = failureMessage ?? getResolvedCreatePinFailureMessage(result)
  return {
    at: new Date().toISOString(),
    phase,
    serviceId: context.service.id ?? '',
    serviceName: context.service.serviceName ?? context.service.displayName ?? '',
    providerGlobalMetaId: context.provider.globalMetaId ?? '',
    providerName: context.provider.name ?? '',
    paymentTxid: context.payment.paymentTxid ?? '',
    orderReference: context.payment.orderReference ?? '',
    sessionKey: context.sessionKey ?? '',
    resolvedPinId: pinId,
    failureMessage: failure,
    errorName: extractErrorName(error),
    errorMessage: extractErrorMessage(error),
    txidCandidates: Array.from(new Set(collectTxidLikeStrings(result))),
    resultShape: summarizeUnknown(result ?? error),
  }
}

export function recordCreatePinDiagnostic(diagnostic: CreatePinDiagnostic): void {
  if (!import.meta.env.DEV || typeof window === 'undefined') return
  const w = window as typeof window & {
    __bothubLastCreatePinDiagnostic?: CreatePinDiagnostic
  }
  w.__bothubLastCreatePinDiagnostic = diagnostic

  try {
    const previous = JSON.parse(
      window.sessionStorage.getItem(CREATE_PIN_DIAGNOSTICS_STORAGE_KEY) ?? '[]',
    ) as CreatePinDiagnostic[]
    const next = [...previous, diagnostic].slice(-MAX_DIAGNOSTICS)
    window.sessionStorage.setItem(CREATE_PIN_DIAGNOSTICS_STORAGE_KEY, JSON.stringify(next))
  } catch (err) {
    console.warn('Could not store createPin diagnostic.', err)
  }

  console.info('[Bothub createPin diagnostic]', diagnostic)
}

export function getLastCreatePinDiagnostic(): CreatePinDiagnostic | null {
  if (typeof window === 'undefined') return null
  const w = window as typeof window & {
    __bothubLastCreatePinDiagnostic?: CreatePinDiagnostic
  }
  if (w.__bothubLastCreatePinDiagnostic) return w.__bothubLastCreatePinDiagnostic

  try {
    const diagnostics = JSON.parse(
      window.sessionStorage.getItem(CREATE_PIN_DIAGNOSTICS_STORAGE_KEY) ?? '[]',
    ) as CreatePinDiagnostic[]
    return diagnostics[diagnostics.length - 1] ?? null
  } catch {
    return null
  }
}
