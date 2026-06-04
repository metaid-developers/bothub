/** meta-socket envelope: code 0 is success */
export interface ApiEnvelope<T> {
  code: number
  message: string
  data: T | null
}

export type SkillServiceOutputType = 'text' | 'image' | 'video' | 'audio' | 'other'
export type SkillServiceCurrency = 'BTC' | 'SPACE' | 'DOGE' | 'MRC20'
export type SkillServiceChainName = 'mvc' | 'btc' | 'doge' | 'opcat'
export type SkillServiceSortBy = 'rating' | 'updated' | 'price'
export type SkillServiceOrder = 'desc' | 'asc'
export type SkillServiceIdType = 'auto' | 'currentPinId' | 'sourceServicePinId'
export type SettlementKind = 'native' | 'mrc20'
export type SkillServiceOperation = 'create' | 'modify' | 'revoke'

/** Core service fields shared by list items and detail `service` */
export interface SkillServiceCore {
  id: string
  currentPinId: string
  sourceServicePinId: string
  serviceName: string
  displayName: string
  description: string
  serviceIcon: string
  providerSkill: string
  outputType: SkillServiceOutputType
  price: string
  currency: string
  settlementKind: SettlementKind
  paymentChain: string
  mrc20Ticker: string | null
  mrc20Id: string | null
  paymentAddress: string
  status: number
  operation: SkillServiceOperation
  disabled: boolean
  chainName: SkillServiceChainName
  createdAt: number
  updatedAt: number
}

export interface SkillServiceListItem extends SkillServiceCore {
  providerMetaId: string
  providerGlobalMetaId: string
  providerAddress: string
  providerName: string | null
  providerAvatar: string | null
  providerChatPubkey: string | null
  providerLLM: string | null
  ratingAvg: number
  ratingCount: number
}

export interface ProviderInfo {
  metaid: string
  globalMetaId: string
  address: string
  name: string | null
  avatar: string | null
  chatPubkey?: string | null
}

export interface SkillServiceListData {
  list: SkillServiceListItem[]
  nextCursor: string | null
  total: number | null
  aggregatedAt: number
  schemaVersion: string
}

export interface SkillServiceDetailData {
  service: SkillServiceCore
  provider: ProviderInfo
  aggregatedAt: number
  schemaVersion: string
}

export interface ListServicesParams {
  size?: number
  cursor?: string
  keyword?: string
  currency?: SkillServiceCurrency
  chainName?: SkillServiceChainName
  outputType?: SkillServiceOutputType
  providerGlobalMetaId?: string
  sortBy?: SkillServiceSortBy
  order?: SkillServiceOrder
  includeInactive?: number
}

export interface GetServiceDetailParams {
  idType?: SkillServiceIdType
  chainName?: SkillServiceChainName
}
