/// <reference types="@cloudflare/workers-types" />

interface CloudflareEnv {
  CATALOG_DB?: D1Database;
  ADMIN_OWNER_EMAIL?: string;
  ADMIN_DEV_EMAIL?: string;
  ADMIN_RUNTIME_ENV?: "local" | "production";
  CF_ACCESS_TEAM_DOMAIN?: string;
  CF_ACCESS_AUD?: string;
}
