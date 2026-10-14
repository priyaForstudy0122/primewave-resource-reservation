// Tiny .env loader so the scripts work without extra dependencies.
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export function loadEnv() {
  const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
  for (const name of [".env.local", ".env"]) {
    const file = path.join(root, name);
    if (!existsSync(file)) continue;
    for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (m && process.env[m[1]] === undefined) {
        process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, "");
      }
    }
  }
  process.env.DATABASE_URL ??= "postgres://reservation:reservation@localhost:5432/reservation";
}
