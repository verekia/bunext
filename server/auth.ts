import jwt from 'jsonwebtoken'

import type { UserId } from './db'

export const SESSION_EXPIRATION_MS = 1000 * 60 * 60 * 24 * 30 // 30 days
const RENEW_AFTER_MS = 1000 * 60 * 60 * 24 // renew if older than 1 day
const COOKIE_NAME = 'bn_session'

const SESSION_SECRET = process.env.SESSION_SECRET
if (!SESSION_SECRET) throw new Error('SESSION_SECRET not defined')

const isProd = process.env.NODE_ENV === 'production'

export type SessionPayload = { userId: UserId }
export type Session = SessionPayload & { iat: number; exp: number }

export const createSessionToken = (payload: SessionPayload) =>
  jwt.sign(payload, SESSION_SECRET, { algorithm: 'HS256', expiresIn: '30d' })

export const verifySessionToken = (token: string): Session | null => {
  try {
    return jwt.verify(token, SESSION_SECRET) as Session
  } catch {
    return null
  }
}

export const shouldRenew = (session: Session) =>
  Date.now() / 1000 - session.iat > RENEW_AFTER_MS / 1000

export const getSessionTokenFromReq = (req: Request) =>
  req.headers
    .get('cookie')
    ?.split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${COOKIE_NAME}=`))
    ?.slice(COOKIE_NAME.length + 1)

export const getSession = (req: Request) => {
  const token = getSessionTokenFromReq(req)
  return token ? verifySessionToken(token) : null
}

const buildCookie = (value: string, maxAgeMs: number) => {
  // In dev the API (:3001) is cross-origin from the client (:3000) but same-site
  // (both localhost), so SameSite=Lax works for top-level OAuth redirects and
  // for credentialed fetches. In prod everything is on a single origin so Lax is
  // also correct. We only add `Secure` in prod, since Secure cookies are rejected
  // over plain HTTP on localhost.
  const parts = [
    `${COOKIE_NAME}=${value}`,
    'HttpOnly',
    'Path=/',
    'SameSite=Lax',
    `Max-Age=${Math.floor(maxAgeMs / 1000)}`,
  ]
  if (isProd) parts.push('Secure')
  return parts.join('; ')
}

export const setSessionCookie = (res: Response, token: string) => {
  res.headers.set('Set-Cookie', buildCookie(token, SESSION_EXPIRATION_MS))
  return res
}

export const clearSessionCookie = (res: Response) => {
  res.headers.set('Set-Cookie', buildCookie('', 0))
  return res
}

export const renewIfNeeded = (res: Response, session: Session) => {
  if (shouldRenew(session)) setSessionCookie(res, createSessionToken({ userId: session.userId }))
  return res
}
