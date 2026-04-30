import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { type resolveHello, type resolveMe } from 'server/resolvers'

import { api } from '../api'

const apiUrl = process.env.NEXT_PUBLIC_API_URL

const IndexPage = () => {
  const queryClient = useQueryClient()

  const { data: hello } = useQuery({
    queryKey: ['hello'],
    queryFn: () => api<typeof resolveHello>('/hello'),
  })

  const { data: me, isLoading: meLoading } = useQuery({
    queryKey: ['me'],
    queryFn: () => api<typeof resolveMe>('/me'),
  })

  const logout = useMutation({
    mutationFn: () => api('/logout', { method: 'POST' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['me'] }),
  })

  const returnUrl = typeof window !== 'undefined' ? window.location.origin : ''

  return (
    <div style={{ fontFamily: 'sans-serif', padding: 24 }}>
      <h1>Hello {hello?.hello}</h1>

      {meLoading ? (
        <p>Loading...</p>
      ) : me ? (
        <div>
          <p>
            Signed in as <strong>{me.email}</strong> via {me.provider}
          </p>
          <button onClick={() => logout.mutate()}>Sign out</button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 240 }}>
          <a href={`${apiUrl}/auth/google?returnUrl=${encodeURIComponent(returnUrl)}`}>
            Sign in with Google
          </a>
          <a href={`${apiUrl}/auth/github?returnUrl=${encodeURIComponent(returnUrl)}`}>
            Sign in with GitHub
          </a>
        </div>
      )}
    </div>
  )
}

export default IndexPage
