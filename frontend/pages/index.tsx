import { useQuery } from '@tanstack/react-query'
import { type resolveHello } from 'api'

type HelloResponse = Awaited<ReturnType<typeof resolveHello>>

const IndexPage = () => {
  const { data } = useQuery<HelloResponse>({
    queryKey: ['hello'],
    queryFn: () => fetch('http://localhost:3001').then((res) => res.json()),
  })

  if (!data) return null

  return <div>Hello {data.hello}</div>
}

export default IndexPage
