import { readAdminDeployEnv } from "@conpaws/env/admin-deploy";
import alchemy from "alchemy";
import { D1Database, Nextjs } from "alchemy/cloudflare";
import { CloudflareStateStore } from "alchemy/state";
import { config } from "dotenv";

config({ path: "./.env" });
config({ path: "../../apps/admin/.env" });

const env = readAdminDeployEnv(process.env);
const app = await alchemy("conpaws-admin", {
  phase: process.argv.includes("--destroy") ? "destroy" : undefined,
  password: env.ALCHEMY_PASSWORD,
  stateStore: (scope) =>
    new CloudflareStateStore(scope, {
      scriptName: "alchemy-state",
      stateToken: alchemy.secret(env.ALCHEMY_STATE_TOKEN),
    }),
});

const catalog = await D1Database("catalog-database", {
  name: "conpaws-admin-catalog-db",
  adopt: true,
  migrationsDir: "../../apps/admin/drizzle/migrations",
  migrationsTable: "drizzle_migrations",
});

export const admin = await Nextjs("admin", {
  name: "conpaws-admin",
  adopt: true,
  cwd: "../../apps/admin",
  compatibilityDate: "2026-03-10",
  domains: env.ADMIN_ROUTES_ENABLED ? ["admin.conpaws.com"] : undefined,
  url: false,
  previewSubdomains: false,
  bindings: {
    CATALOG_DB: catalog,
    ADMIN_RUNTIME_ENV: "production",
    ADMIN_OWNER_EMAIL: env.ADMIN_OWNER_EMAIL,
    CF_ACCESS_TEAM_DOMAIN: env.CF_ACCESS_TEAM_DOMAIN,
    CF_ACCESS_AUD: env.CF_ACCESS_AUD,
  },
  dev: {
    env: { PORT: "3003" },
  },
});

await app.finalize();
