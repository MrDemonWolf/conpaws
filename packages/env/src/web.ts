import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

/**
 * Build-time / client environment for apps/web.
 *
 * Server-side secrets (LISTMONK_API_TOKEN, TURNSTILE_SECRET_KEY, …) are deliberately
 * NOT declared here. On Cloudflare Workers those arrive as bindings and are read
 * per-request via `getCloudflareContext().env` — they do not exist in
 * `process.env` at build time, so validating them here would fail every build.
 */
export const env = createEnv({
  client: {
    /**
     * Where this deploy actually lives.
     *
     * The default is deliberately NOT the production domain. `robots.ts` asks
     * to be left alone on anything that is not conpaws.com, and it describes
     * that as failing closed -- but a default of `https://conpaws.com` made an
     * unset variable read as canonical, so the branch could never run and a
     * `*.workers.dev` preview served an allow-all robots.txt plus a sitemap of
     * conpaws.com URLs. localhost makes absence mean "not the real site",
     * which is what the rest of the file already assumes.
     *
     * Production must therefore set this explicitly; the deploy workflow does.
     */
    NEXT_PUBLIC_SITE_URL: z.url().default("http://localhost:3001"),
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: z.string().min(1).optional(),
  },
  experimental__runtimeEnv: {
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
  },
  emptyStringAsUndefined: true,
});
