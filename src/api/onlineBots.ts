import { getNormalizedMetasoP2PBaseUrl } from '@/api/config'
import {
  fetchUserProfileByGlobalMetaId,
  normalizeAvatarUrl,
  type UserProfile,
} from '@/api/userProfile'
import { extractLlmFromBio } from '@/lib/llmBio'

export interface OnlineBot {
  globalMetaId: string
  metaId: string
  name: string
  avatar: string
  llm: string
  lastSeenAgoSeconds: number
}

export interface OnlineBotsResult {
  total: number
  bots: OnlineBot[]
}

interface OnlineUserItem {
  metaid?: string
  metaId?: string
  globalMetaId?: string
  type?: string
  connectedAt?: number
  lastSeenAgoSeconds?: number
  lastSeenAt?: number
  userInfo?: {
    metaid?: string
    globalMetaId?: string
    name?: string
    avatar?: string
    avatarUrl?: string
    avatarURL?: string
    avatarImage?: string
    avatarImg?: string
    avatarId?: string
    avatarPinId?: string
    bio?: unknown
    chatPublicKey?: string
  }
}

interface OnlineListData {
  total?: number
  list?: OnlineUserItem[]
  items?: OnlineUserItem[]
}

interface OnlineListResponse {
  code: number
  data?: OnlineListData
  message?: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readString(record: Record<string, unknown> | undefined, keys: string[]): string {
  if (!record) return ''
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return ''
}

function resolveAvatar(userInfo: Record<string, unknown> | undefined): string {
  const avatar = readString(userInfo, [
    'avatarUrl',
    'avatarURL',
    'avatarImage',
    'avatarImg',
    'avatar',
  ])
  const avatarId = readString(userInfo, ['avatarId', 'avatarPinId'])
  return normalizeAvatarUrl(avatar || undefined, avatarId || undefined) ?? avatar
}

function resolveName(userInfo: Record<string, unknown> | undefined, globalMetaId: string): string {
  const name = readString(userInfo, ['name'])
  if (name) return name
  return compactGlobalMetaId(globalMetaId)
}

function compactGlobalMetaId(globalMetaId: string): string {
  if (globalMetaId.length <= 12) return globalMetaId
  return `${globalMetaId.slice(0, 8)}...${globalMetaId.slice(-4)}`
}

function normalizeOnlineBot(item: OnlineUserItem): OnlineBot | null {
  const userInfo = isRecord(item.userInfo) ? item.userInfo : undefined
  const globalMetaId =
    readString(userInfo, ['globalMetaId']) ||
    item.globalMetaId?.trim() ||
    item.metaid?.trim() ||
    item.metaId?.trim() ||
    ''
  if (!globalMetaId) return null
  if (userInfo && !readString(userInfo, ['chatPublicKey']) && item.type !== 'app') return null

  return {
    globalMetaId,
    metaId: readString(userInfo, ['metaid']) || item.metaId?.trim() || item.metaid?.trim() || '',
    name: resolveName(userInfo, globalMetaId),
    avatar: resolveAvatar(userInfo),
    llm: '',
    lastSeenAgoSeconds: item.lastSeenAgoSeconds || 0,
  }
}

async function enrichOnlineBotBio(bot: OnlineBot): Promise<OnlineBot> {
  try {
    const profile: UserProfile = await fetchUserProfileByGlobalMetaId(bot.globalMetaId)
    const llm = extractLlmFromBio(profile.bio)
    const avatar = profile.avatarUrl ?? normalizeAvatarUrl(bot.avatar) ?? bot.avatar
    if (llm || profile.name || profile.globalMetaId || profile.metaid || avatar !== bot.avatar) {
      return {
        ...bot,
        globalMetaId: profile.globalMetaId ?? bot.globalMetaId,
        metaId: profile.metaid ?? bot.metaId,
        name: profile.name ?? bot.name,
        avatar,
        llm: llm ?? bot.llm,
      }
    }
  } catch {
    // Keep bot as-is
  }
  return bot
}

async function enrichOnlineBotsBio(bots: OnlineBot[]): Promise<OnlineBot[]> {
  if (!bots.length) return bots

  const enriched = [...bots]
  let nextIndex = 0
  const workerCount = Math.min(8, enriched.length)

  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (nextIndex < enriched.length) {
        const currentIndex = nextIndex
        nextIndex += 1
        enriched[currentIndex] = await enrichOnlineBotBio(enriched[currentIndex])
      }
    }),
  )

  return enriched
}

export async function getOnlineBots(page = 1, size = 100): Promise<OnlineBotsResult> {
  const baseUrl = getNormalizedMetasoP2PBaseUrl()
  const url = `${baseUrl}/socket/online/list?page=${page}&size=${size}`

  const response = await fetch(url)
  const envelope = (await response.json()) as OnlineListResponse

  if (envelope.code !== 0 || !envelope.data) {
    return { total: 0, bots: [] }
  }

  const data = envelope.data
  const list = data.list || data.items || []

  const bots: OnlineBot[] = []
  for (const item of list) {
    const bot = normalizeOnlineBot(item)
    if (bot) bots.push(bot)
  }

  const enrichedBots = await enrichOnlineBotsBio(bots)

  return {
    total: data.total ?? enrichedBots.length,
    bots: enrichedBots,
  }
}
