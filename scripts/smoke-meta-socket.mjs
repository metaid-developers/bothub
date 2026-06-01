import { io } from 'socket.io-client'

const DEFAULT_BASE_URL = 'http://127.0.0.1:18091'
const DEFAULT_SMOKE_METAID = 'bothub-smoke-metaid'
const REQUEST_TIMEOUT_MS = 8000
const SOCKET_TIMEOUT_MS = 10000
const baseUrl = normalizeBaseUrl(process.env.META_SOCKET_BASE_URL || DEFAULT_BASE_URL)
const smokeMetaid = process.env.META_SOCKET_SMOKE_METAID || DEFAULT_SMOKE_METAID
const privateChatMetaId = process.env.META_SOCKET_PRIVATE_CHAT_METAID || ''
const privateChatOtherMetaId = process.env.META_SOCKET_PRIVATE_CHAT_OTHER_METAID || ''

function normalizeBaseUrl(value) {
  return value.replace(/\/+$/, '')
}

function fail(message, detail) {
  const suffix = detail ? `: ${detail}` : ''
  console.error(`[smoke:meta-socket] ${message}${suffix}`)
  process.exit(1)
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

async function fetchJson(pathname, label) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  const url = `${baseUrl}${pathname}`

  try {
    const response = await fetch(url, { signal: controller.signal })
    if (!response.ok) {
      throw new Error(`${label} returned HTTP ${response.status}`)
    }
    return await response.json()
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    throw new Error(`${label} request failed (${url}): ${reason}`)
  } finally {
    clearTimeout(timeout)
  }
}

function assertSuccessEnvelope(envelope, label) {
  assert(envelope && typeof envelope === 'object', `${label} did not return an object envelope`)
  assert(envelope.code === 0, `${label} returned non-zero code ${envelope.code}: ${envelope.message || ''}`)
  assert(envelope.data !== null && envelope.data !== undefined, `${label} returned empty data`)
}

function pickServiceId(service) {
  return service.id || service.currentPinId || service.sourceServicePinId
}

function classifyIdentity(value) {
  if (!value) return 'missing'
  if (/^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/.test(value)) return 'address-like'
  if (/^[a-z]{2,}\d[a-z0-9]{20,}$/i.test(value)) return 'local-metaid/globalMetaId-like'
  return 'unknown'
}

function isPrivateChatItemShape(value) {
  return (
    value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    typeof value.fromGlobalMetaId === 'string' &&
    value.fromGlobalMetaId.trim() &&
    typeof value.toGlobalMetaId === 'string' &&
    value.toGlobalMetaId.trim() &&
    typeof value.content === 'string' &&
    typeof value.timestamp === 'number' &&
    Number.isFinite(value.timestamp)
  )
}

function summarizePrivateChatRows(rows) {
  const fieldNames = ['fromGlobalMetaId', 'toGlobalMetaId', 'content', 'timestamp']
  const usableCount = rows.filter(isPrivateChatItemShape).length
  return {
    count: rows.length,
    privateChatItemCompatible: usableCount === rows.length,
    compatibleCount: usableCount,
    normalizationFields: fieldNames,
  }
}

async function smokePrivateChat() {
  if (!privateChatMetaId || !privateChatOtherMetaId) {
    return {
      skipped: true,
      reason:
        'set META_SOCKET_PRIVATE_CHAT_METAID and META_SOCKET_PRIVATE_CHAT_OTHER_METAID to enable live private-chat checks',
    }
  }

  const homesPath = `/api/group-chat/chat/homes/${encodeURIComponent(privateChatMetaId)}`
  const listPath = `/api/group-chat/private-chat-list?metaId=${encodeURIComponent(
    privateChatMetaId,
  )}&otherMetaId=${encodeURIComponent(privateChatOtherMetaId)}&cursor=&size=5`

  const homes = await fetchJson(homesPath, 'private chat homes')
  assertSuccessEnvelope(homes, 'private chat homes')
  assert(
    homes.data.list === null || Array.isArray(homes.data.list),
    'private chat homes data.list is not an array',
  )

  const chatList = await fetchJson(listPath, 'private chat list')
  assertSuccessEnvelope(chatList, 'private chat list')
  assert(
    chatList.data.list === null || Array.isArray(chatList.data.list),
    'private chat list data.list is not an array',
  )

  const homesRows = homes.data.list ?? []
  const messageRows = chatList.data.list ?? []
  const messageSummary = summarizePrivateChatRows(messageRows)
  assert(
    messageSummary.privateChatItemCompatible,
    'private chat list rows cannot be normalized to src/ws/privateChat.ts PrivateChatItem fields',
  )

  for (const home of homesRows) {
    if (home?.lastMessage) {
      assert(
        isPrivateChatItemShape(home.lastMessage),
        'private chat homes lastMessage cannot be normalized to src/ws/privateChat.ts PrivateChatItem fields',
      )
    }
  }

  return {
    skipped: false,
    urls: {
      homes: `${baseUrl}${homesPath}`,
      privateChatList: `${baseUrl}${listPath}`,
    },
    identities: {
      metaId: {
        value: privateChatMetaId,
        observedKind: classifyIdentity(privateChatMetaId),
      },
      otherMetaId: {
        value: privateChatOtherMetaId,
        observedKind: classifyIdentity(privateChatOtherMetaId),
      },
    },
    homes: {
      count: homesRows.length,
      hasLastMessage: homesRows.some((home) => Boolean(home?.lastMessage)),
    },
    privateChatList: messageSummary,
  }
}

async function smokeSocket() {
  return new Promise((resolve, reject) => {
    let settled = false
    let timer
    const socket = io(baseUrl, {
      path: '/socket/socket.io',
      transports: ['websocket', 'polling'],
      query: { metaid: smokeMetaid, type: 'app' },
      reconnection: false,
      timeout: SOCKET_TIMEOUT_MS,
      autoUnref: true,
    })
    const finish = (error, payload) => {
      if (settled) return
      settled = true
      if (timer) clearTimeout(timer)
      socket.removeAllListeners()
      socket.disconnect()
      if (error) {
        reject(error)
      } else {
        resolve(payload ?? null)
      }
    }
    timer = setTimeout(() => {
      finish(new Error(`socket did not receive heartbeat_ack within ${SOCKET_TIMEOUT_MS}ms`))
    }, SOCKET_TIMEOUT_MS)

    socket.once('connect', () => {
      socket.emit('ping')
    })

    socket.once('heartbeat_ack', (payload) => {
      finish(null, payload)
    })

    socket.once('connect_error', (error) => {
      finish(new Error(`socket connect failed: ${error.message}`))
    })

    socket.once('disconnect', (reason) => {
      if (!settled && reason === 'io server disconnect') {
        finish(new Error(`socket disconnected before heartbeat_ack: ${reason}`))
      }
    })
  })
}

async function main() {
  const health = await fetchJson('/healthz', 'healthz')
  assertSuccessEnvelope(health, 'healthz')

  const list = await fetchJson(
    '/api/bot-hub/skill-service/list?size=3&chainName=mvc&sortBy=updated&order=desc',
    'skill-service list',
  )
  assertSuccessEnvelope(list, 'skill-service list')
  assert(list.data.schemaVersion === 'botHubSkillService.v1', 'skill-service list schemaVersion mismatch')
  assert(Array.isArray(list.data.list), 'skill-service list data.list is not an array')
  assert(list.data.list.length > 0, 'skill-service list returned an empty list')

  const firstService = list.data.list[0]
  const listDetailId = pickServiceId(firstService)
  assert(listDetailId, 'first skill-service item is missing id/currentPinId/sourceServicePinId')

  const detail = await fetchJson(
    `/api/bot-hub/skill-service/detail/${encodeURIComponent(listDetailId)}?chainName=mvc`,
    'skill-service detail',
  )
  assertSuccessEnvelope(detail, 'skill-service detail')
  assert(
    detail.data.schemaVersion === 'botHubSkillServiceDetail.v1',
    'skill-service detail schemaVersion mismatch',
  )
  assert(detail.data.service?.id || detail.data.service?.currentPinId, 'skill-service detail missing service id')
  assert(detail.data.provider && typeof detail.data.provider === 'object', 'skill-service detail missing provider')
  assert(
    detail.data.provider.globalMetaId || detail.data.provider.metaid || detail.data.provider.address,
    'skill-service detail provider is missing identity fields',
  )

  const stats = await fetchJson('/socket/online/stats', 'socket online stats')
  assertSuccessEnvelope(stats, 'socket online stats')

  const privateChat = await smokePrivateChat()
  const heartbeatAck = await smokeSocket()

  console.log(
    JSON.stringify({
      ok: true,
      baseUrl,
      smokeMetaid,
      health: health.data.status || 'ok',
      list: {
        count: list.data.list.length,
        schemaVersion: list.data.schemaVersion,
        firstListDetailId: listDetailId,
      },
      detail: {
        schemaVersion: detail.data.schemaVersion,
        serviceId: detail.data.service.id || detail.data.service.currentPinId,
        providerGlobalMetaId: detail.data.provider.globalMetaId || null,
      },
      socket: {
        onlineStats: stats.data,
        heartbeatAck: Boolean(heartbeatAck !== undefined),
      },
      privateChat,
    }),
  )
}

main()
  .then(() => {
    process.exit(0)
  })
  .catch((error) => {
    fail('smoke failed', error instanceof Error ? error.message : String(error))
  })
