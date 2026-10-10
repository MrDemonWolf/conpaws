/**
 * Invite someone to ConPaws Admin from your own machine.
 *
 * This is how the first owner gets in: there is no first-visitor claim on the
 * live site. It writes an invite with your Cloudflare credentials, then the
 * invitee signs in with an emailed code. After that, owners invite people
 * from the Team screen.
 */
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { inviteSql, parseInviteArgs } from "./invite-sql.mjs";

const USAGE = `Invite someone to ConPaws Admin.

  bun run admin:invite -- you@example.com [--role owner|editor] [--local]

The invite lasts seven days. They sign in at https://admin.conpaws.com/sign-in
with that address and get a one-time code by email. --role defaults to owner,
which is what you want for the first person. --local writes to the local
development catalog instead of production; add --persist-to DIR if your local
Worker keeps its state somewhere other than apps/admin/.wrangler/state.

Production uses your Wrangler login (bunx wrangler login) or the
CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID environment variables. If your
login covers more than one Cloudflare account, set CLOUDFLARE_ACCOUNT_ID too:
this command cannot show Wrangler's account picker.`;

if (process.env.CI || process.env.GITHUB_ACTIONS) {
  console.error(
    "admin:invite does not run in CI. Its output names an email address, and this repository's logs are public.",
  );
  process.exit(1);
}

const parsed = parseInviteArgs(process.argv.slice(2));
if (parsed.help) {
  console.log(USAGE);
  process.exit(0);
}
if (parsed.error) {
  console.error(`${parsed.error}\n\n${USAGE}`);
  process.exit(1);
}

const adminDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const sql = inviteSql({
  email: parsed.email,
  role: parsed.role,
  now: Date.now(),
  id: randomUUID(),
});
const target = parsed.local
  ? ["CATALOG_DB", "--local", "--persist-to", parsed.persistTo]
  : ["conpaws-admin-catalog-db", "--remote"];

const result = spawnSync(
  "bunx",
  ["wrangler", "d1", "execute", ...target, "--command", sql, "--json"],
  { cwd: adminDir, encoding: "utf8", stdio: ["inherit", "pipe", "inherit"] },
);
/**
 * With --json, Wrangler reports failures as JSON on stdout, not stderr, so
 * read the reason from there instead of swallowing it.
 */
function wranglerError(output) {
  try {
    const parsed = JSON.parse(output.slice(output.indexOf("{")));
    if (typeof parsed?.error?.text === "string") return parsed.error.text;
  } catch {
    // Not JSON: fall through to the raw output.
  }
  return output.trim();
}

if (result.status !== 0) {
  const reason = wranglerError(result.stdout ?? "");
  console.error("Wrangler could not write the invite. Nothing was changed.");
  if (reason) console.error(`\n${reason}`);
  if (/no such table/i.test(reason)) {
    console.error(
      parsed.local
        ? "\nApply the local migrations first: bun run --filter @conpaws/admin db:migrate:local"
        : "\nThe catalog database has no admin tables yet. Deploy first with bun run deploy.",
    );
  }
  if (/more than one account/i.test(reason)) {
    console.error(
      "\nSet CLOUDFLARE_ACCOUNT_ID to the ConPaws account and run this again.",
    );
  }
  process.exit(result.status ?? 1);
}

let statements;
try {
  const output = result.stdout ?? "";
  statements = JSON.parse(output.slice(output.indexOf("[")));
} catch {
  console.error(
    "Wrangler's output was not the JSON expected. Check the Team screen.",
  );
  process.exit(1);
}
const outcome = statements.at(-1)?.results?.[0] ?? {};

if (outcome.member_status) {
  console.log(
    `${parsed.email} is already on the team (${outcome.member_status}). Change their role or access on the Team screen.`,
  );
  process.exit(0);
}
if (outcome.invite_role !== parsed.role) {
  console.error("The invite was not saved. Nothing was changed.");
  process.exit(1);
}

const signIn = parsed.local
  ? "http://127.0.0.1:3003/sign-in"
  : "https://admin.conpaws.com/sign-in";
console.log(
  `Invited ${parsed.email} as ${parsed.role}. The invite lasts seven days.`,
);
console.log(
  `Next: open ${signIn}, enter that address, and type the code ConPaws emails you.`,
);
if (parsed.local) {
  console.log(
    "Locally the code is printed in the dev server log instead of being emailed.",
  );
}
