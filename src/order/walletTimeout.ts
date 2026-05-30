export const CREATE_PIN_WALLET_RESPONSE_TIMEOUT_MS = 90_000

export class WalletResponseTimeoutError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'WalletResponseTimeoutError'
  }
}

export function withWalletResponseTimeout<T>(
  promise: Promise<T>,
  message: string,
  timeoutMs = CREATE_PIN_WALLET_RESPONSE_TIMEOUT_MS,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new WalletResponseTimeoutError(message))
    }, timeoutMs)

    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (err: unknown) => {
        clearTimeout(timer)
        reject(err)
      },
    )
  })
}
