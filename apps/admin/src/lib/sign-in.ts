/**
 * Email-code sign-in for the admin console.
 *
 * Only people already on the team, or holding an unexpired invite, are ever
 * sent a code. Whether an address qualifies is decided after the browser has
 * its response, so the sign-in form behaves identically for every address.
 * Codes are stored as an HMAC bound to the browser attempt that asked for
 * them; sessions as the SHA-256 of a random cookie token.
 */
import { z } from "zod";
import type { AdminBindings } from "./db";
import {
  generateSignInCode,
  hashSessionToken,
  hashSignInCode,
  isRandomToken,
  randomToken,
  verifySignInCodeHash,
} from "./sign-in-crypto";

export type AdminRole = "owner" | "editor";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export const SIGN_IN_POLICY = {
  codeLifetimeMs: 10 * MINUTE,
  maxAttemptsPerCode: 5,
  resendCooldownMs: MINUTE,
  maxCodesPerHour: 5,
  maxCodesPerDay: 10,
  sessionLifetimeMs: 7 * DAY,
  /** Team changes need a code entered this recently, like GitHub's sudo mode. */
  freshSessionMs: 2 * HOUR,
  inviteLifetimeMs: 7 * DAY,
  /** Sent codes outlive their expiry so the daily send limit can count them. */
  codeRetentionMs: 2 * DAY,
} as const;

/** Input is already trimmed by `formString`. */
export const signInEmailSchema = z
  .email()
  .max(254)
  .transform((value) => value.toLowerCase());

const LOCAL_ONLY_SECRET = "local-development-only-conpaws-admin-sign-in-key";

/**
 * The HMAC key for sign-in codes. Production binds a generated value; local
 * development may fall back to a fixed key. Anything else fails closed.
 */
export function signInSecret(env: AdminBindings) {
  const secret = env.ADMIN_AUTH_SECRET?.trim();
  if (secret && secret.length >= 32) return secret;
  return env.ADMIN_RUNTIME_ENV === "local" ? LOCAL_ONLY_SECRET : null;
}

export function isFreshSession(
  session: { verifiedAt: number },
  now = Date.now(),
) {
  return now - session.verifiedAt < SIGN_IN_POLICY.freshSessionMs;
}

export type IssueResult = "sent" | "undelivered" | "ineligible" | "throttled";

/**
 * Sends a code if, and only if, the address may sign in and has not hit a
 * send limit. A new code for the same browser attempt replaces the old one.
 */
export async function issueSignInCode(input: {
  database: D1Database;
  secret: string;
  attemptId: string;
  email: string;
  now: number;
  deliver: (code: string) => Promise<boolean>;
}): Promise<IssueResult> {
  const { database, secret, attemptId, email, now } = input;
  const state = await database
    .prepare(
      `SELECT
         (SELECT status FROM admin_members WHERE email = ?1) AS memberStatus,
         (SELECT expires_at FROM admin_invites WHERE email = ?1) AS inviteExpiresAt,
         (SELECT MAX(created_at) FROM admin_sign_in_codes WHERE email = ?1) AS lastSentAt,
         (SELECT COUNT(*) FROM admin_sign_in_codes WHERE email = ?1 AND created_at > ?2) AS sentLastHour,
         (SELECT COUNT(*) FROM admin_sign_in_codes WHERE email = ?1 AND created_at > ?3) AS sentLastDay`,
    )
    .bind(email, now - HOUR, now - DAY)
    .first<{
      memberStatus: "active" | "disabled" | null;
      inviteExpiresAt: number | null;
      lastSentAt: number | null;
      sentLastHour: number;
      sentLastDay: number;
    }>();
  if (!state) return "ineligible";

  // A disabled member stays out even with an invite: invites never re-enable.
  const eligible =
    state.memberStatus === "active" ||
    (state.memberStatus === null &&
      state.inviteExpiresAt !== null &&
      state.inviteExpiresAt > now);
  if (!eligible) return "ineligible";

  if (
    (state.lastSentAt !== null &&
      state.lastSentAt > now - SIGN_IN_POLICY.resendCooldownMs) ||
    state.sentLastHour >= SIGN_IN_POLICY.maxCodesPerHour ||
    state.sentLastDay >= SIGN_IN_POLICY.maxCodesPerDay
  ) {
    return "throttled";
  }

  const code = generateSignInCode();
  await database.batch([
    database
      .prepare(
        `UPDATE admin_sign_in_codes SET consumed_at = ?1
         WHERE attempt_id = ?2 AND consumed_at IS NULL`,
      )
      .bind(now, attemptId),
    database
      .prepare(
        `INSERT INTO admin_sign_in_codes
           (id, attempt_id, email, code_hash, attempts, created_at, expires_at)
         VALUES (?1, ?2, ?3, ?4, 0, ?5, ?6)`,
      )
      .bind(
        randomToken(16),
        attemptId,
        email,
        await hashSignInCode(secret, attemptId, email, code),
        now,
        now + SIGN_IN_POLICY.codeLifetimeMs,
      ),
  ]);
  return (await input.deliver(code)) ? "sent" : "undelivered";
}

export type CodeCheck =
  | { status: "valid"; email: string }
  | { status: "wrong" | "locked" | "expired" };

/**
 * Checks a code against the newest one sent to this browser attempt. Every
 * check spends one of the code's five tries before the comparison, in one
 * atomic statement, so parallel guesses cannot exceed the limit.
 */
export async function checkSignInCode(input: {
  database: D1Database;
  secret: string;
  attemptId: string;
  code: string;
  now: number;
}): Promise<CodeCheck> {
  const { database, secret, attemptId, code, now } = input;
  const row = await database
    .prepare(
      `UPDATE admin_sign_in_codes
       SET attempts = attempts + 1
       WHERE id = (
           SELECT id FROM admin_sign_in_codes
           WHERE attempt_id = ?1 AND consumed_at IS NULL
           ORDER BY created_at DESC, rowid DESC
           LIMIT 1
         )
         AND expires_at > ?2
         AND attempts < ?3
       RETURNING id, email, code_hash AS codeHash, attempts`,
    )
    .bind(attemptId, now, SIGN_IN_POLICY.maxAttemptsPerCode)
    .first<{ id: string; email: string; codeHash: string; attempts: number }>();
  if (!row) return { status: "expired" };

  const valid = await verifySignInCodeHash(
    secret,
    attemptId,
    row.email,
    code,
    row.codeHash,
  );
  if (!valid) {
    return {
      status:
        row.attempts >= SIGN_IN_POLICY.maxAttemptsPerCode ? "locked" : "wrong",
    };
  }

  // Single use, and any other code still out for this address dies with it.
  const [consumed] = await database.batch([
    database
      .prepare(
        `UPDATE admin_sign_in_codes SET consumed_at = ?1
         WHERE id = ?2 AND consumed_at IS NULL`,
      )
      .bind(now, row.id),
    database
      .prepare(
        `UPDATE admin_sign_in_codes SET consumed_at = ?1
         WHERE email = ?2 AND consumed_at IS NULL`,
      )
      .bind(now, row.email),
  ]);
  if (consumed?.meta.changes !== 1) return { status: "expired" };
  return { status: "valid", email: row.email };
}

export type Admission =
  | { status: "member"; role: AdminRole }
  | { status: "disabled" | "not-invited" };

/**
 * Lets a verified address in: an active member as they are, or an invitee by
 * turning a live invite into an active membership with the invited role.
 */
export async function admitMember(input: {
  database: D1Database;
  email: string;
  now: number;
}): Promise<Admission> {
  const { database, email, now } = input;
  await database.batch([
    // INSERT ... SELECT keeps this atomic with the invite still existing, so a
    // revoke that lands first wins.
    database
      .prepare(
        `INSERT INTO admin_members (email, role, status, created_at, created_by)
         SELECT email, role, 'active', ?2, invited_by FROM admin_invites
         WHERE email = ?1 AND expires_at > ?2
         ON CONFLICT(email) DO NOTHING`,
      )
      .bind(email, now),
    database
      .prepare(
        `INSERT INTO audit_log (id, actor_email, action, resource_type, resource_id, summary)
         SELECT ?1, ?2, 'admin.invite-accepted', 'admin_member', ?2,
           'Accepted an invite as ' || (SELECT role FROM admin_members WHERE email = ?2)
         WHERE changes() = 1`,
      )
      .bind(crypto.randomUUID(), email),
    database
      .prepare(
        `DELETE FROM admin_invites
         WHERE email = ?1 AND EXISTS (SELECT 1 FROM admin_members WHERE email = ?1)`,
      )
      .bind(email),
  ]);

  const member = await database
    .prepare("SELECT role, status FROM admin_members WHERE email = ?1")
    .bind(email)
    .first<{ role: AdminRole; status: "active" | "disabled" }>();
  if (!member) return { status: "not-invited" };
  if (member.status !== "active") return { status: "disabled" };
  return { status: "member", role: member.role };
}

/**
 * Starts a session and returns the cookie token. The browser's previous
 * session, if any, ends here, and expired rows are swept on the way.
 */
export async function startSession(input: {
  database: D1Database;
  email: string;
  now: number;
  replacingToken?: string;
}) {
  const { database, email, now } = input;
  const token = randomToken(32);
  const statements = [
    database
      .prepare("DELETE FROM admin_sessions WHERE expires_at <= ?1")
      .bind(now),
    database
      .prepare("DELETE FROM admin_sign_in_codes WHERE created_at < ?1")
      .bind(now - SIGN_IN_POLICY.codeRetentionMs),
    database
      .prepare(
        `INSERT INTO admin_sessions (token_hash, email, created_at, expires_at, verified_at)
         VALUES (?1, ?2, ?3, ?4, ?3)`,
      )
      .bind(
        await hashSessionToken(token),
        email,
        now,
        now + SIGN_IN_POLICY.sessionLifetimeMs,
      ),
    database
      .prepare(
        `INSERT INTO audit_log (id, actor_email, action, resource_type, resource_id, summary)
         VALUES (?1, ?2, 'admin.signed-in', 'admin_member', ?2, 'Signed in with an email code')`,
      )
      .bind(crypto.randomUUID(), email),
  ];
  if (input.replacingToken && isRandomToken(input.replacingToken, 32)) {
    statements.unshift(
      database
        .prepare("DELETE FROM admin_sessions WHERE token_hash = ?1")
        .bind(await hashSessionToken(input.replacingToken)),
    );
  }
  await database.batch(statements);
  return token;
}

export interface StoredSession {
  email: string;
  verifiedAt: number;
  expiresAt: number;
  role: AdminRole | null;
  status: "active" | "disabled" | null;
}

export async function readSession(
  database: D1Database,
  token: string,
  now: number,
) {
  if (!isRandomToken(token, 32)) return null;
  return database
    .prepare(
      `SELECT s.email AS email, s.verified_at AS verifiedAt,
              s.expires_at AS expiresAt, m.role AS role, m.status AS status
       FROM admin_sessions s
       LEFT JOIN admin_members m ON m.email = s.email
       WHERE s.token_hash = ?1 AND s.expires_at > ?2`,
    )
    .bind(await hashSessionToken(token), now)
    .first<StoredSession>();
}

export async function endSession(database: D1Database, token: string) {
  if (!isRandomToken(token, 32)) return;
  await database
    .prepare("DELETE FROM admin_sessions WHERE token_hash = ?1")
    .bind(await hashSessionToken(token))
    .run();
}

export async function endAllSessions(database: D1Database, email: string) {
  await database
    .prepare("DELETE FROM admin_sessions WHERE email = ?1")
    .bind(email)
    .run();
}
