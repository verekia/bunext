const apiUrl = process.env.NEXT_PUBLIC_API_URL

type Resolver = (...args: never) => unknown

export const api = async <R extends Resolver>(
  path: string,
  init?: RequestInit,
): Promise<Awaited<ReturnType<R>>> => {
  const res = await fetch(`${apiUrl}${path}`, { credentials: 'include', ...init })
  return res.json()
}
