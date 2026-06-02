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

/** Parse Socket.IO `message` payload.
 *
 *  Accepted shapes (matching IDBots metaWebListener + demo-chat):
 *  1.  `["WS_SERVER_NOTIFY_PRIVATE_CHAT", { … }]`        — Socket.IO array
 *  2.  `{ M: "…", D: { … } }`                            — canonical envelope
 *  3.  `{ M: "…", data: { … } }`                         — alternate key
 *  4.  `{ M: "…", C: 0, D: { … } }`                      — with code (C is ignored)
 *
 *  The `C` field is NOT required — IDBots and demo-chat don't enforce it.
 */
export function parseSocketEnvelope(raw: unknown): SocketEnvelope | null {
  let value = raw
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value) as unknown
    } catch {
      return null
    }
  }

  // Socket.IO array format: ["EVENT", payload]
  if (Array.isArray(value) && value.length >= 2) {
    const eventType = value[0]
    const payload = value[1]
    if (!isKnownEventType(eventType) || !isRecord(payload)) return null
    return { M: eventType, C: 0, D: payload as SocketEnvelope['D'] }
  }

  if (!isRecord(value)) return null

  const eventType = value.M
  if (!isKnownEventType(eventType)) return null

  // Prefer `D`, fall back to `data` (demo-chat compatibility)
  const payload = isRecord(value.D)
    ? value.D
    : isRecord(value.data)
      ? value.data
      : null
  if (!payload) return null

  return {
    M: eventType,
    C: 0,
    D: payload as SocketEnvelope['D'],
  }
}
