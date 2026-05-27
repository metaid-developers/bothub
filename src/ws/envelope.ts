export const WS_SERVER_NOTIFY_GROUP_CHAT = 'WS_SERVER_NOTIFY_GROUP_CHAT'
export const WS_SERVER_NOTIFY_PRIVATE_CHAT = 'WS_SERVER_NOTIFY_PRIVATE_CHAT'
export const WS_SERVER_NOTIFY_GROUP_ROLE = 'WS_SERVER_NOTIFY_GROUP_ROLE'

export const KNOWN_PUSH_EVENT_TYPES = [
  WS_SERVER_NOTIFY_GROUP_CHAT,
  WS_SERVER_NOTIFY_PRIVATE_CHAT,
  WS_SERVER_NOTIFY_GROUP_ROLE,
] as const

export type KnownPushEventType = (typeof KNOWN_PUSH_EVENT_TYPES)[number]

export interface SocketEnvelope<T = unknown> {
  M: KnownPushEventType
  C: 0
  D: T
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isKnownEventType(value: unknown): value is KnownPushEventType {
  return (
    typeof value === 'string' &&
    (KNOWN_PUSH_EVENT_TYPES as readonly string[]).includes(value)
  )
}

/** Parse Socket.IO `message` payload `{ M, C, D }`; only `C === 0` push envelopes. */
export function parseSocketEnvelope(raw: unknown): SocketEnvelope | null {
  let value = raw
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value) as unknown
    } catch {
      return null
    }
  }

  if (!isRecord(value)) return null

  const code = value.C
  if (code !== 0 && code !== '0') return null

  const eventType = value.M
  if (!isKnownEventType(eventType)) return null

  return {
    M: eventType,
    C: 0,
    D: value.D,
  }
}
