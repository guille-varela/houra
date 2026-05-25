import { hashPassword, verifyPassword } from 'better-auth/crypto'

const TOKEN_TTL_MS = 24 * 60 * 60 * 1000  // 24 h

function getSecret(): string {
  const s = process.env.BETTER_AUTH_SECRET
  if (!s) throw new Error('BETTER_AUTH_SECRET not set')
  return s
}

export async function hashReportPassword(password: string): Promise<string> {
  return hashPassword(password)
}

export async function checkReportPassword(hash: string, password: string): Promise<boolean> {
  return verifyPassword({ hash, password })
}

export async function createReportToken(slug: string): Promise<string> {
  const expiry = Date.now() + TOKEN_TTL_MS
  const payload = `${slug}:${expiry}`
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(getSecret()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sigBuf = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload))
  const sigHex = Array.from(new Uint8Array(sigBuf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
  return Buffer.from(`${payload}.${sigHex}`).toString('base64url')
}

export async function verifyReportToken(slug: string, token: string): Promise<boolean> {
  try {
    const decoded = Buffer.from(token, 'base64url').toString()
    const dotIdx = decoded.lastIndexOf('.')
    if (dotIdx === -1) return false
    const payload = decoded.slice(0, dotIdx)
    const sigHex = decoded.slice(dotIdx + 1)
    const [tokenSlug, expiryStr] = payload.split(':')
    if (tokenSlug !== slug) return false
    if (Date.now() > parseInt(expiryStr ?? '0', 10)) return false
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(getSecret()),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify'],
    )
    const sigBytes = new Uint8Array(
      (sigHex.match(/.{2}/g) ?? []).map((b) => parseInt(b, 16)),
    )
    return await crypto.subtle.verify(
      'HMAC',
      key,
      sigBytes,
      new TextEncoder().encode(payload),
    )
  } catch {
    return false
  }
}
