/** Human-readable price + currency for skill-service list cards */
export function formatPrice(
  price: string,
  currency: string,
): { amount: string; currency: string } {
  const amount = typeof price === 'string' ? price.trim() || '0' : String(price ?? '0')
  const normalized =
    typeof currency === 'string' ? currency.trim().toUpperCase() : String(currency ?? '')
  const displayCurrency = normalized === 'MVC' ? 'SPACE' : normalized
  return { amount, currency: displayCurrency }
}

/** Compact relative time label for updated timestamps */
export function formatRelativeTime(timestamp: number, now = Date.now()): string {
  const diff = Math.max(0, now - timestamp)
  const minutes = Math.floor(diff / 60_000)
  const hours = Math.floor(diff / 3_600_000)
  const days = Math.floor(diff / 86_400_000)

  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days === 1) return 'yesterday'
  if (days < 7) return `${days}d ago`
  return new Date(timestamp).toLocaleDateString()
}

/** Shorten long addresses / meta ids for display */
export function formatAddress(value: string, head = 6, tail = 4): string {
  const trimmed = value.trim()
  if (trimmed.length <= head + tail + 1) return trimmed
  return `${trimmed.slice(0, head)}…${trimmed.slice(-tail)}`
}
