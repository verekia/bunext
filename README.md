# bunext

This is a minimal project of a type-safe full-stack app using Next.js in SSG export mode + Bun for the API + React Query for fetching. The goal of this template is to show the full integration, from dev, to local prod, to actual deployed prod via Docker.

It includes Postgres + migrations + a minimal OAuth (Google, GitHub) sign-in flow with JWT session cookies.

## Setup

1. `bun i`
2. `bun db:up` to start a local Postgres via `docker compose`
3. Create OAuth apps and fill in `server/.env.development.local`:
   - **Google**: https://console.cloud.google.com/apis/credentials — set the redirect URI to `http://localhost:3001/auth/callback/google`
   - **GitHub**: https://github.com/settings/developers — set the callback URL to `http://localhost:3001/auth/callback/github`
4. `bun migrate` to apply DB migrations (also runs automatically on server start)
5. `bun dev`

In dev the client is on `:3000` and the API is on `:3001`. In prod the compiled binary serves both on `:3000`.

## Auth notes

- JWT is signed with `SESSION_SECRET` (HS256, 30-day expiry) and stored in an `HttpOnly` cookie named `bn_session`.
- Sessions auto-renew when the JWT is older than 1 day (any call to `/me` slides it forward).
- Cookies use `SameSite=Lax`. `Secure` is added in prod (`NODE_ENV=production`); dev runs over plain HTTP on localhost.
- We don't store any Google/GitHub tokens — only the verified primary email is used to upsert the user row.
