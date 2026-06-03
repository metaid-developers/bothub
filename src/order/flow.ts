export {
  broadcastPreparedOrder,
  executePayAndRequest,
  executeServicePayment,
  generateRandomHex,
  isFreeServicePrice,
  PayAndRequestBroadcastError,
  PayAndRequestError,
  prepareEncryptedOrderMessage,
  validatePayAndRequestInput,
} from './payAndRequestStages'
export { getLastCreatePinDiagnostic } from './createPinDiagnostics'

export type {
  ExecutePayAndRequestInput,
  ExecutePayAndRequestResult,
  PayAndRequestMetalet,
  PayAndRequestPaymentResult,
  PreparedPayAndRequest,
} from './payAndRequestStages'

export interface DeliveryOrderPathTarget {
  id: string
  orderPinId?: string | null
  orderCorrelationId?: string | null
}

export function deliveryOrderParamFor(target: string | DeliveryOrderPathTarget): string {
  if (typeof target === 'string') return target
  return (
    target.orderPinId?.trim() ||
    target.orderCorrelationId?.trim() ||
    target.id.trim()
  )
}

export function buildDeliveryOrderPath(orderId: string | DeliveryOrderPathTarget): string {
  const orderParam = deliveryOrderParamFor(orderId)
  return `/delivery?order=${encodeURIComponent(orderParam)}`
}

export function buildDeliverySessionPath(sessionKey: string): string {
  return `/delivery?session=${encodeURIComponent(sessionKey)}`
}
