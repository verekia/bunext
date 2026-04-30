import { createSessionToken, setSessionCookie } from './auth'
import { upsertUserByEmail } from './db'

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo'

const GITHUB_AUTH_URL = 'https://github.com/login/oauth/authorize'
const GITHUB_TOKEN_URL = 'https://github.com/login/oauth/access_token'
const GITHUB_EMAILS_URL = 'https://api.github.com/user/emails'

const apiUrl = () => {
  const u = process.env.API_URL
  if (!u) throw new Error('API_URL not defined')
  return u
}

const clientUrl = () => {
  const u = process.env.CLIENT_URL
  if (!u) throw new Error('CLIENT_URL not defined')
  return u
}

const env = (key: string) => {
  const v = process.env[key]
  if (!v) throw new Error(`${key} not defined`)
  return v
}

const parseState = (raw: string | null): { returnUrl: string } => {
  if (!raw) return { returnUrl: clientUrl() }
  try {
    const parsed = JSON.parse(decodeURIComponent(raw))
    return { returnUrl: typeof parsed.returnUrl === 'string' ? parsed.returnUrl : clientUrl() }
  } catch {
    return { returnUrl: clientUrl() }
  }
}

// --- Google ---

export const buildGoogleAuthRedirect = (returnUrl: string) => {
  const params = new URLSearchParams({
    client_id: env('GOOGLE_CLIENT_ID'),
    redirect_uri: `${apiUrl()}/auth/callback/google`,
    response_type: 'code',
    scope: 'openid email',
    state: encodeURIComponent(JSON.stringify({ returnUrl })),
    access_type: 'online',
    prompt: 'select_account',
  })
  return `${GOOGLE_AUTH_URL}?${params.toString()}`
}

export const handleGoogleCallback = async (req: Request) => {
  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const { returnUrl } = parseState(url.searchParams.get('state'))

  if (!code) return Response.redirect(`${returnUrl}?auth_error=no_code`, 302)

  const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env('GOOGLE_CLIENT_ID'),
      client_secret: env('GOOGLE_CLIENT_SECRET'),
      code,
      grant_type: 'authorization_code',
      redirect_uri: `${apiUrl()}/auth/callback/google`,
    }).toString(),
  })

  if (!tokenRes.ok) return Response.redirect(`${returnUrl}?auth_error=token`, 302)

  const { access_token, token_type } = (await tokenRes.json()) as {
    access_token: string
    token_type: string
  }

  const userRes = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `${token_type} ${access_token}` },
  })

  if (!userRes.ok) return Response.redirect(`${returnUrl}?auth_error=userinfo`, 302)

  const profile = (await userRes.json()) as { email?: string; verified_email?: boolean }
  if (!profile.email) return Response.redirect(`${returnUrl}?auth_error=no_email`, 302)
  if (!profile.verified_email) return Response.redirect(`${returnUrl}?auth_error=unverified`, 302)

  const userId = await upsertUserByEmail(profile.email, 'google')

  const res = Response.redirect(returnUrl, 302)
  return setSessionCookie(res, createSessionToken({ userId }))
}

// --- GitHub ---

export const buildGithubAuthRedirect = (returnUrl: string) => {
  const params = new URLSearchParams({
    client_id: env('GITHUB_CLIENT_ID'),
    redirect_uri: `${apiUrl()}/auth/callback/github`,
    scope: 'read:user user:email',
    state: encodeURIComponent(JSON.stringify({ returnUrl })),
  })
  return `${GITHUB_AUTH_URL}?${params.toString()}`
}

export const handleGithubCallback = async (req: Request) => {
  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const { returnUrl } = parseState(url.searchParams.get('state'))

  if (!code) return Response.redirect(`${returnUrl}?auth_error=no_code`, 302)

  const tokenRes = await fetch(GITHUB_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: new URLSearchParams({
      client_id: env('GITHUB_CLIENT_ID'),
      client_secret: env('GITHUB_CLIENT_SECRET'),
      code,
      redirect_uri: `${apiUrl()}/auth/callback/github`,
    }).toString(),
  })

  if (!tokenRes.ok) return Response.redirect(`${returnUrl}?auth_error=token`, 302)

  const { access_token, token_type } = (await tokenRes.json()) as {
    access_token: string
    token_type: string
  }

  // GitHub's /user only returns the public email; pull verified primary from /user/emails.
  const emailsRes = await fetch(GITHUB_EMAILS_URL, {
    headers: {
      Authorization: `${token_type} ${access_token}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'bunext',
    },
  })

  if (!emailsRes.ok) return Response.redirect(`${returnUrl}?auth_error=userinfo`, 302)

  const emails = (await emailsRes.json()) as {
    email: string
    primary: boolean
    verified: boolean
  }[]
  const primary = emails.find((e) => e.primary && e.verified) ?? emails.find((e) => e.verified)
  if (!primary) return Response.redirect(`${returnUrl}?auth_error=no_verified_email`, 302)

  const userId = await upsertUserByEmail(primary.email, 'github')

  const res = Response.redirect(returnUrl, 302)
  return setSessionCookie(res, createSessionToken({ userId }))
}
