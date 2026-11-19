import { existsSync, readdirSync } from 'node:fs'
import { createServer } from 'node:http'
import handler from 'serve-handler'

import { resolveHello } from './resolvers'

const PORT = process.env.PORT
if (!PORT) throw new Error('PORT not defined')
const isProd = process.env.NODE_ENV === 'production'

const STATIC_PORT = 57471
const STATIC_DIR = './client'

// Next exports a dynamic page as a file named after its route, like date/[date].html
const dynamicPages = (
  existsSync(STATIC_DIR) ? readdirSync(STATIC_DIR, { recursive: true, encoding: 'utf8' }) : []
)
  .filter((file) => file.endsWith('.html') && file.includes('['))
  .map((file) => {
    const route = `/${file.replace(/\.html$/, '')}`
    const pattern = route.replace(/\[\.\.\.[^\]]+\]/g, '.+').replace(/\[[^\]]+\]/g, '[^/]+')
    return { route, regex: new RegExp(`^${pattern}$`) }
  })
  // A more specific route wins, like /users/[id] over /[...path]
  .sort((a, b) => a.route.split('[').length - b.route.split('[').length)

createServer((req, res) =>
  handler(req, res, {
    public: STATIC_DIR,
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
    // Only pages are left here, and they never read a body
    if (req.method !== 'GET' && req.method !== 'HEAD')
      return Response.json({ message: 'Not found' }, { status: 404 })

    const url = new URL(req.url)
    const serve = (pathname: string) =>
      fetch(`http://127.0.0.1:${STATIC_PORT}${pathname}${url.search}`, {
        method: req.method,
        headers: req.headers,
        redirect: 'manual',
      })

    const res = await serve(url.pathname)
    if (res.status !== 404) return res

    const page = dynamicPages.find(({ regex }) => regex.test(url.pathname))
    return page ? serve(page.route) : res
  },
  error(error) {
    console.error(error)
    return Response.json({ message: 'Internal Server Error' }, { status: 500 })
  },
})

console.log(`${isProd ? 'Fullstack app' : 'Dev server'} running on port ${PORT}`)
