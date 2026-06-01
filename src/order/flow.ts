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

export function buildDeliveryOrderPath(orderId: string): string {
  return `/delivery?order=${encodeURIComponent(orderId)}`
}

export function buildDeliverySessionPath(sessionKey: string): string {
  return `/delivery?session=${encodeURIComponent(sessionKey)}`
}
