import { sql } from 'bun'

export type UserId = string & { readonly __brand: 'UserId' }
export type Provider = 'google' | 'github'

export type DbUser = {
  id: UserId
  email: string
  provider: Provider
  created_at: Date
  updated_at: Date
}

const makeId = () =>
  Array.from({ length: 16 }, () =>
    'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.charAt(
      Math.floor(Math.random() * 62),
    ),
  ).join('') as UserId

export const getUserById = async (id: UserId) => {
  const [user]: Pick<DbUser, 'id' | 'email' | 'provider'>[] = await sql`
    SELECT id, email, provider FROM "user" WHERE id = ${id}`
  return user
}

export const getUserByEmail = async (email: string) => {
  const [user]: Pick<DbUser, 'id' | 'provider'>[] = await sql`
    SELECT id, provider FROM "user" WHERE email = ${email}`
  return user
}

export const createUser = async (email: string, provider: Provider) => {
  const id = makeId()
  const [user]: Pick<DbUser, 'id'>[] = await sql`
    INSERT INTO "user" ${sql({ id, email, provider })}
    RETURNING id`
  return user?.id
}

export const upsertUserByEmail = async (email: string, provider: Provider) => {
  const existing = await getUserByEmail(email)
  if (existing) return existing.id
  const id = await createUser(email, provider)
  if (!id) throw new Error('Failed to create user')
  return id
}
