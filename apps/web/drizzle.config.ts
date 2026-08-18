import { defineConfig } from "drizzle-kit";

// Migrations are generated here and applied two ways: locally by
// `wrangler d1 migrations apply DB --local`, and remotely by Alchemy, which
// reads the same directory (see packages/infra/alchemy.run.ts).
export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle/migrations",
  dialect: "sqlite",
  driver: "d1-http",
});
