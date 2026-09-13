import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'

// AES-256-GCM for connection tokens. The key is derived from TOKEN_ENCRYPTION_KEY; without it, values are stored as given.
const PREFIX = 'enc:v1:'
let key: Buffer | null = process.env.TOKEN_ENCRYPTION_KEY ? createHash('sha256').update(process.env.TOKEN_ENCRYPTION_KEY).digest() : null

export const encryptionEnabled = () => key !== null
export const setEncryptionKey = (secret: string | null) => {
  key = secret ? createHash('sha256').update(secret).digest() : null
}

export function encryptSecret(value: string): string {
  if (!key) return value
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const body = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
  return `${PREFIX}${iv.toString('base64')}:${cipher.getAuthTag().toString('base64')}:${body.toString('base64')}`
}

export function decryptSecret(stored: string): string {
  if (!stored.startsWith(PREFIX)) return stored
  if (!key) throw new Error('A stored token is encrypted but TOKEN_ENCRYPTION_KEY is not set.')
  const [iv, tag, body] = stored.slice(PREFIX.length).split(':')
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv!, 'base64'))
  decipher.setAuthTag(Buffer.from(tag!, 'base64'))
  return Buffer.concat([decipher.update(Buffer.from(body!, 'base64')), decipher.final()]).toString('utf8')
}
