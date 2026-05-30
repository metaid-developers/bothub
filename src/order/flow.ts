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

export type {
  ExecutePayAndRequestInput,
  ExecutePayAndRequestResult,
  PayAndRequestMetalet,
  PayAndRequestPaymentResult,
  PreparedPayAndRequest,
} from './payAndRequestStages'

export function buildDeliverySessionPath(sessionKey: string): string {
  return `/delivery?session=${encodeURIComponent(sessionKey)}`
}
