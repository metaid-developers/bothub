import {
  getAssetsForSession,
  getOrdersForWallet,
  getSessionsForWallet,
} from '@/delivery/db'
import type {
  BuyerOrder,
  DeliveryAssetRecord,
  DeliverySessionRecord,
} from '@/delivery/domain'

export interface DeliveryWorkspaceRecords {
  orders: BuyerOrder[]
  sessions: DeliverySessionRecord[]
  assetsBySession: Record<string, DeliveryAssetRecord[]>
}

export async function loadDeliveryWorkspaceRecords(
  walletGlobalMetaId: string,
): Promise<DeliveryWorkspaceRecords> {
  const wallet = walletGlobalMetaId.trim()
  if (!wallet) return { orders: [], sessions: [], assetsBySession: {} }

  const [orders, sessions] = await Promise.all([
    getOrdersForWallet(wallet),
    getSessionsForWallet(wallet),
  ])
  const assetGroups = await Promise.all(
    sessions.map(
      async (session) => [session.id, await getAssetsForSession(session.id)] as const,
    ),
  )
  return {
    orders,
    sessions,
    assetsBySession: Object.fromEntries(
      assetGroups.filter(([, assets]) => assets.length > 0),
    ),
  }
}
