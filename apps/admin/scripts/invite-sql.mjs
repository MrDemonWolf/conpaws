/**
 * The pure half of scripts/invite.mjs: argument parsing and the SQL it runs.
 * Kept separate so the tests can run this exact SQL against SQLite.
 */

export const INVITE_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;
export const INVITED_BY = "command line";

/**
 * zod's email rule, which the console's own forms use, on the lowercased
 * address: letters, digits and _ ' + - in dot-separated parts before the @,
 * a dotted domain after it. No spaces, quotes other than the apostrophe, or
 * semicolons can get through.
 */
const EMAIL =
  /^(?:[a-z0-9_'+-]+\.)*[a-z0-9_'+-]*[a-z0-9_+-]@(?:[a-z0-9][a-z0-9-]*\.)+[a-z]{2,}$/;

export function isInviteEmail(value) {
  return typeof value === "string" && value.length <= 254 && EMAIL.test(value);
}

export function parseInviteArgs(argv) {
  let email = null;
  let role = "owner";
  let local = false;
  let persistTo = ".wrangler/state";
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") return { help: true };
    if (arg === "--local") {
      local = true;
    } else if (arg === "--role") {
      role = argv[index + 1];
      index += 1;
    } else if (arg.startsWith("--role=")) {
      role = arg.slice("--role=".length);
    } else if (arg === "--persist-to") {
      persistTo = argv[index + 1];
      index += 1;
    } else if (!arg.startsWith("-") && email === null) {
      email = arg;
    } else {
      return { error: `Unexpected argument: ${arg}` };
    }
  }
  if (!email) return { error: "Give the email address to invite." };
  const normalized = email.trim().toLowerCase();
  if (!isInviteEmail(normalized)) {
    return { error: `${normalized} doesn't look like an email address.` };
  }
  if (role !== "owner" && role !== "editor") {
    return { error: "--role must be owner or editor." };
  }
  if (!persistTo || persistTo.startsWith("-")) {
    return { error: "--persist-to needs a directory." };
  }
  return { email: normalized, role, local, persistTo };
}

/** SQLite string literal. Only single quotes need doubling. */
function quote(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

/**
 * Saves the invite unless the address is already a member, records it in the
 * audit log, and reports what is now true for the address. An existing
 * invite is renewed with the new role.
 */
export function inviteSql({ email, role, now, id }) {
  if (!isInviteEmail(email)) throw new Error("Invalid email for invite SQL.");
  if (role !== "owner" && role !== "editor") {
    throw new Error("Invalid role for invite SQL.");
  }
  if (!Number.isSafeInteger(now)) throw new Error("Invalid time.");
  if (!/^[0-9a-f-]{36}$/.test(id)) throw new Error("Invalid audit id.");
  const address = quote(email);
  return [
    `INSERT INTO admin_invites (email, role, invited_by, created_at, expires_at)
SELECT ${address}, ${quote(role)}, ${quote(INVITED_BY)}, ${now}, ${now + INVITE_LIFETIME_MS}
WHERE NOT EXISTS (SELECT 1 FROM admin_members WHERE email = ${address})
ON CONFLICT(email) DO UPDATE SET role = excluded.role, invited_by = excluded.invited_by, created_at = excluded.created_at, expires_at = excluded.expires_at;`,
    `INSERT INTO audit_log (id, actor_email, action, resource_type, resource_id, summary)
SELECT ${quote(id)}, ${quote(INVITED_BY)}, 'admin.invited', 'admin_invite', ${address}, ${quote(`Invited ${email} as ${role} from the command line`)}
WHERE changes() = 1;`,
    `SELECT (SELECT status FROM admin_members WHERE email = ${address}) AS member_status, (SELECT role FROM admin_invites WHERE email = ${address}) AS invite_role;`,
  ].join("\n");
}
