export function truncateGlobalMetaId(gmid: string, head = 6, tail = 4): string {
  if (gmid.length <= head + tail + 1) return gmid
  return `${gmid.slice(0, head)}…${gmid.slice(-tail)}`
}
