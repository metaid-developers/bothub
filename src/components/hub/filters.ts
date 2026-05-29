import type {
  SkillServiceCurrency,
  SkillServiceOrder,
  SkillServiceOutputType,
  SkillServiceSortBy,
} from '@/api/aggregator.types'

export interface HubFilters {
  keyword: string
  currency: SkillServiceCurrency | ''
  outputType: SkillServiceOutputType | ''
  sortBy: SkillServiceSortBy
  order: SkillServiceOrder
}

export const defaultHubFilters: HubFilters = {
  keyword: '',
  currency: '',
  outputType: '',
  sortBy: 'rating',
  order: 'desc',
}
