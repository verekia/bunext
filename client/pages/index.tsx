import { useQuery } from '@tanstack/react-query'
import { type resolveHello } from 'server/resolvers'

type HelloResponse = Awaited<ReturnType<typeof resolveHello>>

console.log(process.env.NODE_ENV)

const IndexPage = () => {
  const { data } = useQuery<HelloResponse>({
    queryKey: ['hello'],
    queryFn: () => fetch(`${process.env.NEXT_PUBLIC_API_URL}/hello`).then((res) => res.json()),
  })

  if (!data) return null

  return <div>Hello {data.hello}</div>
}

export default IndexPage
