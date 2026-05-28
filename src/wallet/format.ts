export function truncateGlobalMetaId(gmid: string | undefined | null, head = 6, tail = 4): string {
  const value = typeof gmid === 'string' ? gmid.trim() : ''
  if (!value) return '—'
  if (value.length <= head + tail + 1) return value
  return `${value.slice(0, head)}…${value.slice(-tail)}`
}
