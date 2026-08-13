import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

/**
 * Build-time / client environment for apps/web.
 *
 * Server-side secrets (BREVO_API_KEY, TURNSTILE_SECRET_KEY, …) are deliberately
 * NOT declared here. On Cloudflare Workers those arrive as bindings and are read
 * per-request via `getCloudflareContext().env` — they do not exist in
 * `process.env` at build time, so validating them here would fail every build.
 */
export const env = createEnv({
  client: {
    NEXT_PUBLIC_SITE_URL: z.url().default("https://conpaws.com"),
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: z.string().min(1).optional(),
  },
  experimental__runtimeEnv: {
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
  },
  emptyStringAsUndefined: true,
});
