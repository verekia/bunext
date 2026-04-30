import { sql } from 'bun'

import init001 from './migrations/001_init.sql' with { type: 'text' }

const migrations = [{ name: '001_init', sql: init001 }] as const

export const migrate = async () => {
  await sql`
    CREATE TABLE IF NOT EXISTS migrations (
      name TEXT PRIMARY KEY,
      applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`

  const applied: { name: string }[] = await sql`SELECT name FROM migrations`
  const appliedSet = new Set(applied.map((r) => r.name))

  let count = 0

  for (const m of migrations) {
    if (appliedSet.has(m.name)) continue

    const statements = m.sql
      .split(';')
      .map((s) => s.trim())
      .filter((s) => s.length > 0)

    await sql.begin(async (tx) => {
      for (const stmt of statements) await tx.unsafe(stmt)
      await tx`INSERT INTO migrations ${sql({ name: m.name })}`
    })

    console.log(`Migration ${m.name} applied`)
    count++
  }

  console.log(`${count} migration(s) applied`)
}

if (import.meta.main) {
  migrate().then(
    () => process.exit(0),
    (err) => {
      console.error(err)
      process.exit(1)
    },
  )
}
