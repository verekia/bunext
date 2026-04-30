import { createServer } from 'node:http'
import handler from 'serve-handler'

import { clearSessionCookie, getSession, renewIfNeeded } from './auth'
import { getUserById, type UserId } from './db'
import { migrate } from './migrate'
import {
  buildGithubAuthRedirect,
  buildGoogleAuthRedirect,
  handleGithubCallback,
  handleGoogleCallback,
} from './oauth'
import { resolveHello, type Me } from './resolvers'

const PORT = process.env.PORT
if (!PORT) throw new Error('PORT not defined')
const isProd = process.env.NODE_ENV === 'production'

const STATIC_PORT = 57471

createServer((req, res) =>
  handler(req, res, {
    public: './client',
    cleanUrls: true,
    trailingSlash: false,
    etag: true,
  }),
).listen(STATIC_PORT, '127.0.0.1')

// In dev the client (:3000) calls the API (:3001) cross-origin and needs
// credentialed CORS. In prod everything is one origin so no headers are needed.
const corsOrigin = process.env.CORS_ORIGIN
const withCors = (res: Response) => {
  if (!corsOrigin) return res
  res.headers.set('Access-Control-Allow-Origin', corsOrigin)
  res.headers.set('Access-Control-Allow-Credentials', 'true')
  res.headers.set('Vary', 'Origin')
  return res
}
const corsPreflight = () => {
  if (!corsOrigin) return new Response(null, { status: 204 })
  return withCors(
    new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Max-Age': '600',
      },
    }),
  )
}

const json = (data: unknown, init?: ResponseInit) =>
  withCors(
    new Response(JSON.stringify(data), {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    }),
  )

const returnUrlFromQuery = (req: Request) => {
  const url = new URL(req.url)
  return url.searchParams.get('returnUrl') ?? process.env.CLIENT_URL ?? '/'
}

migrate().catch((err) => {
  console.error('Migration failed:', err)
  process.exit(1)
})

Bun.serve({
  port: Number(PORT),
  routes: {
    '/hello': {
      OPTIONS: () => corsPreflight(),
      GET: async () => json(await resolveHello()),
    },

    '/me': {
      OPTIONS: () => corsPreflight(),
      GET: async (req) => {
        const session = getSession(req)
        if (!session) return json(null satisfies Me | null)
        const user = await getUserById(session.userId as UserId)
        const body: Me | null = user
          ? { id: user.id, email: user.email, provider: user.provider }
          : null
        const res = json(body)
        if (user) renewIfNeeded(res, session)
        else clearSessionCookie(res)
        return res
      },
    },

    '/logout': {
      OPTIONS: () => corsPreflight(),
      POST: () => clearSessionCookie(json({ ok: true })),
    },

    '/auth/google': (req) =>
      Response.redirect(buildGoogleAuthRedirect(returnUrlFromQuery(req)), 302),
    '/auth/github': (req) =>
      Response.redirect(buildGithubAuthRedirect(returnUrlFromQuery(req)), 302),

    '/auth/callback/google': (req) => handleGoogleCallback(req),
    '/auth/callback/github': (req) => handleGithubCallback(req),
  },
  async fetch(req) {
    const url = new URL(req.url)
    return fetch(`http://127.0.0.1:${STATIC_PORT}${url.pathname}${url.search}`, {
      method: req.method,
      headers: req.headers,
      body: req.body,
      redirect: 'manual',
    })
  },
})

console.log(`${isProd ? 'Fullstack app' : 'Dev server'} running on port ${PORT}`)
