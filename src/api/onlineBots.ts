import { getNormalizedMetaSocketBaseUrl } from '@/api/config'
import { fetchUserProfileByGlobalMetaId, type UserProfile } from '@/api/userProfile'
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
  metaId?: string
  globalMetaId?: string
  lastSeenAgoSeconds?: number
  lastSeenAt?: number
  userInfo?: {
    metaid?: string
    globalMetaId?: string
    name?: string
    avatar?: string
    avatarImage?: string
    bio?: unknown
    chatPublicKey?: string
  }
}

interface OnlineListData {
  total?: number
  list?: OnlineUserItem[]
}

interface OnlineListResponse {
  code: number
  data?: OnlineListData
  message?: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function resolveAvatar(userInfo: Record<string, unknown> | undefined): string {
  if (!userInfo) return ''
  const avatar = userInfo['avatar'] as string | undefined
  const avatarImage = userInfo['avatarImage'] ?? userInfo['avatarImg'] as string | undefined
  return (typeof avatarImage === 'string' ? avatarImage.trim() : '') ||
    (typeof avatar === 'string' ? avatar.trim() : '')
}

function resolveName(userInfo: Record<string, unknown> | undefined, globalMetaId: string): string {
  if (!userInfo) return compactGlobalMetaId(globalMetaId)
  const name = userInfo['name']
  if (typeof name === 'string' && name.trim()) return name.trim()
  return compactGlobalMetaId(globalMetaId)
}

function compactGlobalMetaId(globalMetaId: string): string {
  if (globalMetaId.length <= 12) return globalMetaId
  return `${globalMetaId.slice(0, 8)}...${globalMetaId.slice(-4)}`
}

function normalizeOnlineBot(item: OnlineUserItem): OnlineBot | null {
  const userInfo = item.userInfo
  const globalMetaId = userInfo?.globalMetaId || item.globalMetaId || ''
  if (!globalMetaId) return null
  if (!userInfo?.chatPublicKey) return null

  const userInfoRecord = isRecord(userInfo) ? userInfo : undefined

  return {
    globalMetaId,
    metaId: (typeof userInfo?.metaid === 'string' ? userInfo.metaid : '') || item.metaId || '',
    name: resolveName(userInfoRecord, globalMetaId),
    avatar: resolveAvatar(userInfoRecord),
    llm: '',
    lastSeenAgoSeconds: item.lastSeenAgoSeconds || 0,
  }
}

async function enrichOnlineBotBio(bot: OnlineBot): Promise<OnlineBot> {
  try {
    const profile: UserProfile = await fetchUserProfileByGlobalMetaId(bot.globalMetaId)
    const llm = extractLlmFromBio(profile.bio)
    if (llm) {
      return { ...bot, llm }
    }
    if (profile.avatarUrl && !bot.avatar) {
      return { ...bot, avatar: profile.avatarUrl }
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

export async function getOnlineBots(
  page = 1,
  size = 100,
): Promise<OnlineBotsResult> {
  const baseUrl = getNormalizedMetaSocketBaseUrl()
  const url = `${baseUrl}/socket/online/list?page=${page}&size=${size}`

  const response = await fetch(url)
  const envelope = (await response.json()) as OnlineListResponse

  if (envelope.code !== 0 || !envelope.data) {
    return { total: 0, bots: [] }
  }

  const data = envelope.data
  const list = data.list || []

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
