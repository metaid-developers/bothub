/**
 * Derive the first 1–2 displayable characters from a name for avatar fallback.
 *
 * - CJK / fullwidth characters (e.g. 中文): take the first 2 characters.
 * - Latin / ASCII names: take the initials of the first 2 words, or first 2 chars.
 * - Fallback: first 2 characters of whatever string is provided.
 */
export function avatarInitials(name: string): string {
  const trimmed = name.trim()
  if (!trimmed) return '?'

  // CJK + fullwidth range
  const cjk = /[\u3000-\u303f\u3040-\u30ff\u31f0-\u31ff\u3200-\u32ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uff00-\uffef]/
  if (cjk.test(trimmed)) {
    const chars = [...trimmed]
    return chars.slice(0, 2).join('')
  }

  // Western name: try initials of first two words
  const words = trimmed.split(/\s+/)
  if (words.length >= 2) {
    const first = words[0]?.charAt(0) ?? ''
    const second = words[1]?.charAt(0) ?? ''
    if (first && second) return (first + second).toUpperCase()
  }

  // Single word: first two characters
  return trimmed.slice(0, 2).toUpperCase()
}

/**
 * 14-colour palette for avatar fallback backgrounds — vivid, dark-theme-safe.
 * Colour is picked deterministically from the identity string.
 */
const AVATAR_COLORS = [
  '#6366f1', // indigo
  '#8b5cf6', // violet
  '#a855f7', // purple
  '#d946ef', // fuchsia
  '#ec4899', // pink
  '#f43f5e', // rose
  '#ef4444', // red
  '#f97316', // orange
  '#eab308', // yellow
  '#22c55e', // green
  '#14b8a6', // teal
  '#06b6d4', // cyan
  '#3b82f6', // blue
  '#64748b', // slate
]

function hashString(value: string): number {
  let hash = 0
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0
  }
  return Math.abs(hash)
}

export function avatarColor(seed: string): string {
  return AVATAR_COLORS[hashString(seed) % AVATAR_COLORS.length] ?? AVATAR_COLORS[0]
}

export function getInitialsAvatar(name: string, gmid: string): string {
  const text = name || gmid || '?'
  const char = text.charAt(0).toUpperCase()
  const hue = Math.abs(
    text.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0),
  ) % 360
  return (
    'data:image/svg+xml,' +
    encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">' +
        '<circle cx="16" cy="16" r="16" fill="hsl(' +
        hue +
        ',55%,45%)"/>' +
        '<text x="16" y="21" text-anchor="middle" font-family="DM Sans,sans-serif" font-size="14" font-weight="500" fill="#fff">' +
        char +
        '</text>' +
        '</svg>',
    )
  )
}
