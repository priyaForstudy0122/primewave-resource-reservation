// Minimal, dependency-light migration runner.
// Applies every .sql file in db/migrations (alphabetical order) exactly once,
// each inside a transaction, and records it in the schema_migrations table.
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { loadEnv } from "./env.mjs";

loadEnv();

const here = path.dirname(fileURLToPath(import.meta.url));
const dir = path.join(here, "..", "db", "migrations");

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

try {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename   TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`);

  const applied = new Set(
    (await client.query("SELECT filename FROM schema_migrations")).rows.map((r) => r.filename),
  );
  const files = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();

  for (const file of files) {
    if (applied.has(file)) {
      console.log(`skip   ${file} (already applied)`);
      continue;
    }
    const sql = await readFile(path.join(dir, file), "utf8");
    try {
      await client.query("BEGIN");
      await client.query(sql);
      await client.query("INSERT INTO schema_migrations (filename) VALUES ($1)", [file]);
      await client.query("COMMIT");
      console.log(`apply  ${file}`);
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    }
  }
  console.log("Migrations complete.");
} finally {
  await client.end();
}
