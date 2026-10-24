import "dotenv/config";
import pg from "pg";
export const pool = new pg.Pool({
  max: 10,
  connectionTimeoutMillis: 8000,
  ssl: process.env.PGSSL === "true" ? { rejectUnauthorized: true } : false,
});
pool.on("error", (error) =>
  console.error("Database pool error:", error.message),
);
export async function transaction(fn) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}
