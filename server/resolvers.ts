// Resolvers describe the shape of API responses. The client imports them as
// types only (via `import { type ... }`) and derives response types via
// `Awaited<ReturnType<typeof resolveX>>`. Keep this file free of Bun/Node-only
// runtime imports so the client's TypeScript build can resolve it.

const getHelloFromDb = async () => ({ hello: 'world ' })

export const resolveHello = async () => getHelloFromDb()

export type Me = { id: string; email: string; provider: 'google' | 'github' }

export const resolveMe = async (_userId: string): Promise<Me | null> => null
