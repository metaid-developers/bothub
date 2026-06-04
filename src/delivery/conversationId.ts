export function globalMetaIdPrefix(value: string | null | undefined): string {
  return value?.trim().slice(0, 8) ?? ''
}

export function resolveDeliveryConversationId(input: {
  storedId?: string | null
  peerGlobalMetaId?: string | null
  selfGlobalMetaId?: string | null
}): string {
  const stored = input.storedId?.trim()
  if (stored) return stored

  const peerPrefix = globalMetaIdPrefix(input.peerGlobalMetaId)
  const selfPrefix = globalMetaIdPrefix(input.selfGlobalMetaId)
  if (peerPrefix && selfPrefix) return `${peerPrefix}-${selfPrefix}`

  return peerPrefix || selfPrefix
}
