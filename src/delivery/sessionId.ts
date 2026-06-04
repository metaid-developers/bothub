export function isGlobalMetaId(value: string | null | undefined): boolean {
  return value?.trim().toLowerCase().startsWith('idq') ?? false
}

export function globalMetaIdPrefix(value: string | null | undefined): string {
  const trimmed = value?.trim() ?? ''
  if (!isGlobalMetaId(trimmed)) return ''
  return trimmed.slice(0, 8)
}

export function normalizeShortSessionId(value: string | null | undefined): string {
  const trimmed = value?.trim() ?? ''
  const [peer, self, extra] = trimmed.split('-')
  if (extra !== undefined || !peer || !self) return ''
  const peerPrefix = globalMetaIdPrefix(peer)
  const selfPrefix = globalMetaIdPrefix(self)
  return peerPrefix && selfPrefix ? `${peerPrefix}-${selfPrefix}` : ''
}

export function buildShortSessionId(input: {
  peerGlobalMetaId?: string | null
  selfGlobalMetaId?: string | null
}): string {
  const peerPrefix = globalMetaIdPrefix(input.peerGlobalMetaId)
  const selfPrefix = globalMetaIdPrefix(input.selfGlobalMetaId)
  return peerPrefix && selfPrefix ? `${peerPrefix}-${selfPrefix}` : ''
}

export function shortSessionIdFromStoredSessionId(
  value: string | null | undefined,
): string {
  const trimmed = value?.trim() ?? ''
  const [selfGlobalMetaId, peerGlobalMetaId] = trimmed.split(':')
  return buildShortSessionId({ peerGlobalMetaId, selfGlobalMetaId })
}

export function resolveDeliverySessionId(input: {
  storedShortId?: string | null
  storedId?: string | null
  peerGlobalMetaId?: string | null
  selfGlobalMetaId?: string | null
}): string {
  return (
    normalizeShortSessionId(input.storedShortId) ||
    shortSessionIdFromStoredSessionId(input.storedId) ||
    buildShortSessionId({
      peerGlobalMetaId: input.peerGlobalMetaId,
      selfGlobalMetaId: input.selfGlobalMetaId,
    })
  )
}

export function withShortSessionId<
  T extends {
    walletGlobalMetaId: string
    providerGlobalMetaId: string
    shortSessionId?: string
  },
>(session: T): T {
  const shortSessionId =
    buildShortSessionId({
      peerGlobalMetaId: session.providerGlobalMetaId,
      selfGlobalMetaId: session.walletGlobalMetaId,
    }) || normalizeShortSessionId(session.shortSessionId)
  const next = { ...session }
  if (shortSessionId) {
    next.shortSessionId = shortSessionId
  } else {
    delete next.shortSessionId
  }
  return next
}
