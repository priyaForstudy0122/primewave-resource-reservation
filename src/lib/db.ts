import { Pool } from "pg";

// One shared connection pool. In `next dev` modules are re-evaluated on hot
// reload, so the pool is cached on globalThis to avoid exhausting connections.
const globalForPg = globalThis as unknown as { __pgPool?: Pool };

export const pool: Pool =
  globalForPg.__pgPool ??
  new Pool({
    connectionString:
      process.env.DATABASE_URL ?? "postgres://reservation:reservation@localhost:5432/reservation",
    max: 10,
  });

if (process.env.NODE_ENV !== "production") globalForPg.__pgPool = pool;

export async function query<T extends object = Record<string, unknown>>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  const result = await pool.query(text, params);
  return result.rows as T[];
}
