/**
 * Email-code sign-in for the admin console.
 *
 * Only people already on the team, or holding an unexpired invite, are ever
 * sent a code. Whether an address qualifies is decided after the browser has
 * its response, and every failed code check looks the same, so neither form
 * reveals who is on the team. Codes are stored as an HMAC bound to the
 * browser attempt that asked for them; sessions as the SHA-256 of a random
 * cookie token.
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
  /**
   * Send limits for one address from one network. Counting per network means
   * a stranger elsewhere cannot use up a member's allowance.
   */
  resendCooldownMs: MINUTE,
  maxCodesPerNetworkHour: 5,
  maxCodesPerNetworkDay: 10,
  /**
   * The ceiling for one address across every network. It bounds guessing at
   * 250 tries a day against 100 million codes, and email floods.
   */
  maxCodesPerAddressDay: 50,
  sessionLifetimeMs: 7 * DAY,
  /** Team changes need a code entered this recently, like GitHub's sudo mode. */
  freshSessionMs: 2 * HOUR,
  inviteLifetimeMs: 7 * DAY,
  /** Sent codes outlive their expiry so the daily limits can count them. */
  codeRetentionMs: 2 * DAY,
} as const;

/** Input is already trimmed by `formString`. */
export const signInEmailSchema = z
  .email()
  .max(254)
  .transform((value) => value.toLowerCase());

const LOCAL_ONLY_SECRET = "local-development-only-conpaws-admin-sign-in-key";

/**
 * The HMAC key for sign-in codes. Production binds a key derived at deploy
 * time; local development may fall back to a fixed key. Anything else fails
 * closed.
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

/** A code that could still be entered: not used, not used up, not expired. */
const LIVE_CODE = "consumed_at IS NULL AND attempts < ?13 AND expires_at > ?6";

/**
 * Sends a code if, and only if, the address may sign in and is within its
 * send limits. A new code for the same browser attempt replaces the old one.
 *
 * The eligibility and limit checks are part of the INSERT itself. D1 runs
 * each statement on its own, so parallel requests cannot all pass a check
 * made before any of them wrote.
 *
 * `signedInAsAddress` is for a browser already signed in as this address,
 * such as an owner confirming before a team change. It is held only to its
 * own once-a-minute resend limit, so nobody else's requests can block it.
 */
export async function issueSignInCode(input: {
  database: D1Database;
  secret: string;
  attemptId: string;
  email: string;
  /** Keyed hash of the requesting network, from `hashRequester`. */
  requester: string;
  now: number;
  signedInAsAddress?: boolean;
  deliver: (code: string) => Promise<boolean>;
}): Promise<IssueResult> {
  const { database, secret, attemptId, email, requester, now } = input;
  const id = randomToken(16);
  const code = generateSignInCode();
  const codeHash = await hashSignInCode(secret, attemptId, email, code);

  const limits = input.signedInAsAddress
    ? `NOT EXISTS (
         SELECT 1 FROM admin_sign_in_codes
         WHERE attempt_id = ?2 AND created_at > ?7 AND ${LIVE_CODE}
       )`
    : `NOT EXISTS (
         SELECT 1 FROM admin_sign_in_codes
         WHERE email = ?3 AND requester = ?5 AND created_at > ?7 AND ${LIVE_CODE}
       )
       AND (SELECT COUNT(*) FROM admin_sign_in_codes
            WHERE email = ?3 AND requester = ?5 AND created_at > ?8) < ?10
       AND (SELECT COUNT(*) FROM admin_sign_in_codes
            WHERE email = ?3 AND requester = ?5 AND created_at > ?9) < ?11
       AND (SELECT COUNT(*) FROM admin_sign_in_codes
            WHERE email = ?3 AND created_at > ?9) < ?12`;

  const [inserted] = await database.batch([
    database
      .prepare(
        `INSERT INTO admin_sign_in_codes
           (id, attempt_id, email, code_hash, requester, attempts, created_at, expires_at)
         SELECT ?1, ?2, ?3, ?4, ?5, 0, ?6, ?14
         WHERE (
             EXISTS (SELECT 1 FROM admin_members WHERE email = ?3 AND status = 'active')
             OR (
               NOT EXISTS (SELECT 1 FROM admin_members WHERE email = ?3)
               AND EXISTS (SELECT 1 FROM admin_invites WHERE email = ?3 AND expires_at > ?6)
             )
           )
           AND ${limits}`,
      )
      .bind(
        id,
        attemptId,
        email,
        codeHash,
        requester,
        now,
        now - SIGN_IN_POLICY.resendCooldownMs,
        now - HOUR,
        now - DAY,
        SIGN_IN_POLICY.maxCodesPerNetworkHour,
        SIGN_IN_POLICY.maxCodesPerNetworkDay,
        SIGN_IN_POLICY.maxCodesPerAddressDay,
        SIGN_IN_POLICY.maxAttemptsPerCode,
        now + SIGN_IN_POLICY.codeLifetimeMs,
      ),
    // Retire the attempt's earlier code, but only if a new one went in.
    database
      .prepare(
        `UPDATE admin_sign_in_codes SET consumed_at = ?2
         WHERE attempt_id = ?3 AND consumed_at IS NULL AND id != ?1
           AND EXISTS (SELECT 1 FROM admin_sign_in_codes WHERE id = ?1)`,
      )
      .bind(id, now, attemptId),
  ]);

  if (inserted?.meta.changes === 1) {
    return (await input.deliver(code)) ? "sent" : "undelivered";
  }

  // Nothing was sent. Say why, for logs and tests; the visitor never sees it.
  const eligible = await database
    .prepare(
      `SELECT 1 AS eligible WHERE
         EXISTS (SELECT 1 FROM admin_members WHERE email = ?1 AND status = 'active')
         OR (
           NOT EXISTS (SELECT 1 FROM admin_members WHERE email = ?1)
           AND EXISTS (SELECT 1 FROM admin_invites WHERE email = ?1 AND expires_at > ?2)
         )`,
    )
    .bind(email, now)
    .first();
  return eligible ? "throttled" : "ineligible";
}

export type CodeCheck =
  | { status: "valid"; email: string }
  | { status: "wrong" | "locked" | "expired" };

/** Compared against when there is no code, so both paths do the same work. */
const NO_CODE_HASH = "0".repeat(64);

/**
 * Checks a code against the newest one sent to this browser attempt. Every
 * check spends one of the code's five tries before the comparison, in one
 * atomic statement, so parallel guesses cannot exceed the limit.
 *
 * Callers must show every failure the same way: an attempt for an address
 * that was never sent a code has no row and comes back `expired`, while a
 * member's comes back `wrong`, and telling them apart would reveal the team.
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

  const valid = await verifySignInCodeHash(
    secret,
    attemptId,
    row?.email ?? "",
    code,
    row?.codeHash ?? NO_CODE_HASH,
  );
  if (!row) return { status: "expired" };
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
    // withdrawal that lands first wins.
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
 * Starts a session and returns the cookie token, or null if the member is no
 * longer active. The session row is written only from an active membership,
 * in one statement, so a disable that lands mid-sign-in cannot leave behind
 * a session that would come back to life if the member were re-enabled.
 * The browser's previous session ends here, and expired rows are swept.
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
  ];
  if (input.replacingToken && isRandomToken(input.replacingToken, 32)) {
    statements.push(
      database
        .prepare("DELETE FROM admin_sessions WHERE token_hash = ?1")
        .bind(await hashSessionToken(input.replacingToken)),
    );
  }
  const sessionIndex = statements.length;
  statements.push(
    database
      .prepare(
        `INSERT INTO admin_sessions (token_hash, email, created_at, expires_at, verified_at)
         SELECT ?1, email, ?3, ?4, ?3 FROM admin_members
         WHERE email = ?2 AND status = 'active'`,
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
         SELECT ?1, ?2, 'admin.signed-in', 'admin_member', ?2, 'Signed in with an email code'
         WHERE changes() = 1`,
      )
      .bind(crypto.randomUUID(), email),
  );
  const results = await database.batch(statements);
  return results[sessionIndex]?.meta.changes === 1 ? token : null;
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

/**
 * Ends every session belonging to the owner of this live session token, and
 * returns how many ended. Zero means the token was not a live session, so
 * nothing was proven and nothing else was touched.
 */
export async function endEverySession(
  database: D1Database,
  token: string,
  now: number,
) {
  if (!isRandomToken(token, 32)) return 0;
  const result = await database
    .prepare(
      `DELETE FROM admin_sessions
       WHERE email = (
         SELECT email FROM admin_sessions WHERE token_hash = ?1 AND expires_at > ?2
       )`,
    )
    .bind(await hashSessionToken(token), now)
    .run();
  return result.meta.changes ?? 0;
}
