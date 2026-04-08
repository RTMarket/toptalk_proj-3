import { createHash } from 'node:crypto'

export function sha256Hex(s: string): string {
  return createHash('sha256').update(s, 'utf8').digest('hex')
}

export function randomToken(bytes = 32): string {
  const arr = new Uint8Array(bytes)
  crypto.getRandomValues(arr)
  // hex
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('')
}

