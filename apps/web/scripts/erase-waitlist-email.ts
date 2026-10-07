/**
 * Mark a waitlist row erased and retain only its address, consent wording, and
 * signup time as an unsubscribe/suppression record.
 * Usage from apps/web: bun scripts/erase-waitlist-email.ts person@example.com [--remote]
 * Defaults to local D1; --remote explicitly targets the deployed DB. Do not
 * run --remote without the owner's approval.
 */
import { spawnSync } from "node:child_process";

const email = process.argv[2]?.trim().toLowerCase();
if (!email || !/^[^\s'";]+@[^\s'";]+\.[^\s'";]+$/.test(email)) {
  throw new Error(
    "Usage: bun scripts/erase-waitlist-email.ts email@example.com [--remote]",
  );
}
const remote = process.argv.includes("--remote");
const escapedEmail = email.replaceAll("'", "''");
const command = `UPDATE waitlist SET status = 'unsubscribed', confirmed_at = NULL, erased_at = unixepoch() * 1000, name = '', ip = NULL, ip_bucket = NULL, user_agent = NULL, country = NULL, referer = NULL, utm_source = NULL, utm_medium = NULL, utm_campaign = NULL WHERE email = '${escapedEmail}';`;
const result = spawnSync(
  "bunx",
  [
    "wrangler",
    "d1",
    "execute",
    "DB",
    ...(remote ? ["--remote"] : ["--local"]),
    "--command",
    command,
  ],
  { stdio: "inherit" },
);
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);
