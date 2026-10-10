/// <reference types="@cloudflare/workers-types" />

interface CloudflareEnv {
  CATALOG_DB?: D1Database;
  ADMIN_RUNTIME_ENV?: "local" | "production";
  ADMIN_DEV_EMAIL?: string;
  ADMIN_AUTH_SECRET?: string;
  ADMIN_PUBLIC_URL?: string;
  ADMIN_EMAIL_FROM?: string;
  ADMIN_EMAIL?: SendEmail;
  ADMIN_SIGN_IN_LIMITER?: RateLimit;
}
