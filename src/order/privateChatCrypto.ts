import CryptoJS from 'crypto-js'

const PRIVATE_CHAT_SALT = (
  CryptoJS.lib.WordArray as {
    create: (words: number[], sigBytes?: number) => CryptoJS.lib.WordArray
  }
).create([180470613, 109027952], 8)

/** AES-encrypt plaintext with ECDH shared secret (hex), matching IDBots private chat. */
export function ecdhEncryptWithSharedSecret(plaintext: string, sharedSecretHex: string): string {
  const cipherParams = (
    CryptoJS.lib.PasswordBasedCipher as {
      encrypt: (
        cipher: unknown,
        message: CryptoJS.lib.WordArray,
        password: string,
        cfg: { salt: CryptoJS.lib.WordArray; format: unknown },
      ) => CryptoJS.lib.CipherParams
    }
  ).encrypt(
    CryptoJS.algo.AES,
    CryptoJS.enc.Utf8.parse(String(plaintext ?? '')),
    String(sharedSecretHex ?? ''),
    {
      salt: PRIVATE_CHAT_SALT,
      format: CryptoJS.format.OpenSSL,
    },
  )
  return cipherParams.toString()
}
