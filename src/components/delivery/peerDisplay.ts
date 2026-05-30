import { truncateGlobalMetaId } from '@/wallet/format'

export function peerDisplayName(input: {
  name?: string | null
  globalMetaId: string
}): string {
  return input.name?.trim() || truncateGlobalMetaId(input.globalMetaId)
}
