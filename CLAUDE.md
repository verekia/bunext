# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

## Commands

- `bun dev` — runs `client` and `server` dev scripts in parallel via Bun workspace filter
- `bun build` — parallel build (Next.js export for client, single-file compiled binary for server)
- `bun all` — `format:check && lint` (the only quality gate; no test suite exists)
- `bun lint` / `bun lint:fix` — oxlint
- `bun format` / `bun format:check` — oxfmt
- `bun docker:local` — Docker image using `.env.production.local`
- `bun docker:deploy` — Docker image using `.env.deploy`
- `bun db:up` / `bun db:down` — Postgres via `docker compose`
- `bun migrate` — run DB migrations (also runs automatically on server start)

Per-package commands (run from `client/` or `server/`):

- `client`: `next dev`, `next build`
- `server`: `bun --hot .` (dev), `bun build ./index.ts --production --compile --minify --bytecode --outfile bin` (build)

Tooling: oxlint + oxfmt (no ESLint/Prettier). Style is enforced: no semicolons, single quotes, trailing commas, 100-col width, always-parens arrow fns.

## Architecture

Bun workspace monorepo with two packages: `client` (Next.js) and `server` (Bun). The point of the template is end-to-end type safety and a single-binary + static assets fullstack deploy.

**Single-port serving model** (`server/index.ts`): `Bun.serve` owns the public port (`PORT`). API routes are declared in its `routes` map (e.g. `/hello`). Anything else falls through to `fetch(...)`, which proxies to a `node:http` + `serve-handler` instance bound to `127.0.0.1:57471` serving `./client` (the static Next.js export). In dev the static server is unused since `next dev` runs separately; in prod the binary serves both API and static assets on one port.

**Type-safe client→server contracts**: `client/package.json` declares `"server": "workspace:*"` as a devDependency. Pages import resolver _types_ directly: `import { type resolveHello } from 'server/resolvers'` and derive response shapes via `Awaited<ReturnType<typeof resolveHello>>`. Resolvers live in `server/resolvers.ts` and are referenced by both the server route handler and the client's type imports — keep resolvers free of Bun/Node-only runtime imports if their types are consumed by the client.

**Build outputs**:

- `client`: `next.config.js` sets `output: 'export'` → static site emitted to `client/out/`. React Compiler is on (`reactCompiler: true`).
- `server`: `bun build --compile` produces a self-contained executable at `server/bin` that embeds the runtime. Dockerfile copies just `bin`, `client/out`, and a single `.env` into an alpine image (no `bun` in the runtime stage, only `libgcc`/`libstdc++`).

**Env convention**: each package has three env files — `.env.development.local`, `.env.production.local`, `.env.deploy`. The Dockerfile selects one via the `ENV_FILE` build arg, copies it to `.env`, and deletes the others. `client` needs `NEXT_PUBLIC_API_URL`. `server` needs `PORT`, `NODE_ENV`, `DATABASE_URL`, `SESSION_SECRET`, `API_URL`, `CLIENT_URL`, OAuth client IDs/secrets, and (in dev only) `CORS_ORIGIN`. Server-side CORS is enabled in dev when `CORS_ORIGIN` is set (since client and API are on different ports); in prod it's a single origin so CORS headers are skipped.

**Auth** (`server/auth.ts`, `server/oauth.ts`): JWT (HS256, 30-day) signed with `SESSION_SECRET`, stored in an `HttpOnly` cookie `bn_session`. Cookies use `SameSite=Lax`; `Secure` is added when `NODE_ENV=production`. Sessions slide forward (renew) on `/me` if older than 1 day. OAuth flow: `/auth/{google,github}` redirects to provider with `state={returnUrl}`; provider returns to `/auth/callback/{google,github}`; the callback exchanges code → access token → email, upserts the user by email (no provider tokens stored), sets the cookie, and 302s to `state.returnUrl`.

**DB** (`server/db.ts`, `server/migrate.ts`): Bun's built-in `import { sql } from 'bun'` (Postgres). Migrations are `.sql` files under `server/migrations/`, imported as text (`with { type: 'text' }`) so they're embedded into the compiled binary. `migrate()` runs at server start.

**TypeScript**: root `tsconfig.json` is a solution file with project references to `client` and `server`. Server uses strict Bun-flavored config (`noUncheckedIndexedAccess`, `verbatimModuleSyntax`); client uses Next.js's looser default (`strict: false`). Don't tighten one to match the other without intent.
