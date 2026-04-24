const getHelloFromDb = async () => ({ hello: 'world ' })

export const resolveHello = async () => getHelloFromDb()

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

Bun.serve({
  port: process.env.PORT ?? 3001,
  routes: {
    '/': async () => Response.json(await resolveHello(), { headers: corsHeaders }),
  },
})
