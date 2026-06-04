function findRecordValue(record: Record<string, unknown>, key: string): unknown {
  if (Object.prototype.hasOwnProperty.call(record, key)) return record[key]

  const normalizedKey = key.toLowerCase()
  const matchedKey = Object.keys(record).find(
    (item) => item.toLowerCase() === normalizedKey,
  )
  return matchedKey ? record[matchedKey] : undefined
}

function findProviderText(record: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const provider = toProviderText(findRecordValue(record, key))
    if (provider) return provider
  }
  return ''
}

function toProviderText(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (typeof value !== 'object' || Array.isArray(value)) return ''

  const record = value as Record<string, unknown>
  return (
    findProviderText(record, ['primaryProvider', 'fallbackProvider', 'LLM', 'llm']) ||
    findProviderText(record, ['provider', 'model', 'name'])
  )
}

function extractBioProvider(value: unknown): string {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return ''

  const record = value as Record<string, unknown>
  return findProviderText(record, ['primaryProvider', 'fallbackProvider', 'LLM', 'llm'])
}

function tryParseJsonObject(value: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(value)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>
    }
    return null
  } catch {
    return null
  }
}

export function extractLlmFromBio(bio: unknown): string {
  if (!bio) return ''
  if (typeof bio === 'string') {
    const trimmedBio = bio.trim()
    if (!trimmedBio) return ''
    if (trimmedBio.startsWith('{') && trimmedBio.endsWith('}')) {
      return extractBioProvider(tryParseJsonObject(trimmedBio))
    }
    return ''
  }
  return extractBioProvider(bio)
}
