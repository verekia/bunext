import { createServer } from 'node:http'
import handler from 'serve-handler'

import { resolveHello } from './resolvers'

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

Bun.serve({
  port: PORT,
  routes: {
    '/hello': async () => Response.json(await resolveHello()),
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
