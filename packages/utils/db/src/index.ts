import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

const dbUrl = process.env.DATABASE_URL ?? "";
const isNeon = dbUrl.includes("neon.tech");
const isPgBouncer = dbUrl.includes("pgbouncer=true");

export const pool = new Pool({
  ...(dbUrl ? { connectionString: dbUrl } : {}),
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
  ...(isNeon || isPgBouncer ? { ssl: { rejectUnauthorized: false } } : {}),
});

export const db = drizzle(pool, { schema });

/** Verify the database is reachable. Returns true on success, false on failure. */
export async function testConnection(): Promise<boolean> {
  try {
    await pool.query("SELECT 1");
    return true;
  } catch {
    return false;
  }
}

export * from "./schema";
