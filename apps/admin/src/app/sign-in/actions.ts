"use server";

import type { Route } from "next";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { sendAdminEmail, signInCodeEmail } from "../../lib/admin-email";
import { formString } from "../../lib/catalog";
import { type AdminBindings, getAdminContext } from "../../lib/db";
import {
  admitMember,
  checkSignInCode,
  endEverySession,
  endSession,
  issueSignInCode,
  readSession,
  SIGN_IN_POLICY,
  signInEmailSchema,
  signInSecret,
  startSession,
} from "../../lib/sign-in";
import {
  attemptCookieName,
  cookieOptions,
  decodeAttempt,
  encodeAttempt,
  isLocalRuntime,
  safeNextPath,
  sessionCookieName,
} from "../../lib/sign-in-cookies";
import {
  formatSignInCode,
  hashRequester,
  normalizeSignInCode,
  randomToken,
} from "../../lib/sign-in-crypto";

/** Long enough to read the email and resend once; the code itself lasts 10 minutes. */
const ATTEMPT_COOKIE_SECONDS = 30 * 60;

/** The address of the requesting network, as Cloudflare saw it. */
async function requestingNetwork() {
  return (await headers()).get("cf-connecting-ip") ?? "unknown";
}

/**
 * A coarse per-network limit in front of the database's limits. It fails
 * open: the limits in D1 are the ones that matter, and a limiter outage
 * should not lock the team out.
 */
async function withinNetworkLimit(
  env: AdminBindings,
  action: "request" | "verify",
) {
  const limiter = env.ADMIN_SIGN_IN_LIMITER;
  if (!limiter) return true;
  try {
    const key = `${action}:${await requestingNetwork()}`;
    return (await limiter.limit({ key })).success;
  } catch {
    return true;
  }
}

async function deliverCode(env: AdminBindings, email: string, code: string) {
  if (isLocalRuntime(env)) {
    // Development only: there is no real mailbox behind a local Worker.
    console.info(
      `[local only] ConPaws Admin code for ${email}: ${formatSignInCode(code)}`,
    );
    if (!env.ADMIN_EMAIL) return true;
  }
  return sendAdminEmail(env, signInCodeEmail(email, code));
}

/** Back to the form that was used, keeping where to go afterwards. */
function signInError(error: string, next: string | null, resend = false) {
  if (resend) return `/sign-in/code?error=${error}` as Route;
  const after = next ? `&next=${encodeURIComponent(next)}` : "";
  return `/sign-in?error=${error}${after}` as Route;
}

export async function requestSignInCode(formData: FormData) {
  const { env, ctx } = await getAdminContext();
  const resend = formString(formData, "resend") === "1";
  const next = safeNextPath(formString(formData, "next"));
  const parsed = signInEmailSchema.safeParse(formString(formData, "email"));
  if (!parsed.success) redirect(signInError("email", next, resend));
  const database = env.CATALOG_DB;
  const secret = signInSecret(env);
  if (!database || !secret) redirect(signInError("unavailable", next, resend));
  if (!(await withinNetworkLimit(env, "request"))) {
    redirect(signInError("rate", next, resend));
  }

  // Asking again for the same address keeps the same attempt, so a resend
  // that hits the cooldown leaves the code already in the inbox working.
  const email = parsed.data;
  const jar = await cookies();
  const previous = decodeAttempt(jar.get(attemptCookieName(env))?.value);
  const attemptId =
    previous?.email === email ? previous.attemptId : randomToken(16);
  jar.set(
    attemptCookieName(env),
    encodeAttempt({ attemptId, email, next }),
    cookieOptions(env, ATTEMPT_COOKIE_SECONDS),
  );

  // Whether this address may sign in is decided after the response is sent,
  // so the redirect, its timing and the cookie are the same for every
  // address. Nobody can use this form to learn who is on the team.
  const network = await requestingNetwork();
  const sessionToken = jar.get(sessionCookieName(env))?.value;
  const now = Date.now();
  const work = (async () => {
    // A browser already signed in as this address (an owner confirming
    // before a team change) is not held to the address's shared limits.
    const session = sessionToken
      ? await readSession(database, sessionToken, now)
      : null;
    const result = await issueSignInCode({
      database,
      secret,
      attemptId,
      email,
      requester: await hashRequester(secret, network),
      now,
      signedInAsAddress:
        session?.email === email && session.status === "active",
      deliver: (code) => deliverCode(env, email, code),
    });
    if (result === "undelivered") {
      console.error("Sign-in code was not delivered.");
    }
  })().catch((error: unknown) => {
    console.error(
      "Sign-in code request failed:",
      error instanceof Error ? error.message : "unknown error",
    );
  });
  ctx?.waitUntil(work);

  redirect(resend ? "/sign-in/code?resent=1" : "/sign-in/code");
}

export async function verifySignInCode(formData: FormData) {
  const { env } = await getAdminContext();
  const database = env.CATALOG_DB;
  const secret = signInSecret(env);
  if (!database || !secret) redirect("/sign-in?error=unavailable");

  const jar = await cookies();
  const attempt = decodeAttempt(jar.get(attemptCookieName(env))?.value);
  if (!attempt) redirect("/sign-in?error=expired");
  if (!(await withinNetworkLimit(env, "verify"))) {
    redirect("/sign-in/code?error=rate");
  }
  const code = normalizeSignInCode(formString(formData, "code"));
  if (!code) redirect("/sign-in/code?error=format");

  const now = Date.now();
  const check = await checkSignInCode({
    database,
    secret,
    attemptId: attempt.attemptId,
    code,
    now,
  });
  // One answer for a wrong, used-up or expired code, and for an attempt that
  // never had one: anything finer would tell a stranger who is on the team.
  if (check.status !== "valid") redirect("/sign-in/code?error=code");

  // The code proved the address. Who it belongs to comes from the code's row,
  // never from the cookie.
  jar.set(attemptCookieName(env), "", cookieOptions(env, 0));
  const admission = await admitMember({ database, email: check.email, now });
  if (admission.status === "disabled") {
    redirect(signInError("disabled", attempt.next));
  }
  if (admission.status !== "member") {
    redirect(signInError("denied", attempt.next));
  }

  const token = await startSession({
    database,
    email: check.email,
    now,
    replacingToken: jar.get(sessionCookieName(env))?.value,
  });
  // Access was turned off between the check above and the session insert.
  if (!token) redirect(signInError("disabled", attempt.next));
  jar.set(
    sessionCookieName(env),
    token,
    cookieOptions(env, SIGN_IN_POLICY.sessionLifetimeMs / 1000),
  );
  redirect((attempt.next ?? "/") as Route);
}

export async function signOut() {
  const { env } = await getAdminContext();
  const jar = await cookies();
  const token = jar.get(sessionCookieName(env))?.value;
  let ended = true;
  if (token && env.CATALOG_DB) {
    try {
      await endSession(env.CATALOG_DB, token);
    } catch {
      ended = false;
    }
  }
  jar.set(sessionCookieName(env), "", cookieOptions(env, 0));
  redirect(ended ? "/sign-in?signed-out=1" : "/sign-in?error=sign-out");
}

/**
 * Ends every session for the signed-in address, on every device. It reports
 * success only when the database confirms it, because someone using this
 * after a lost laptop must not be told the other sessions ended if they did
 * not.
 */
export async function signOutEverywhere() {
  const { env } = await getAdminContext();
  const jar = await cookies();
  const token = jar.get(sessionCookieName(env))?.value;
  let outcome: "all" | "here" | "failed" = "here";
  if (token && env.CATALOG_DB) {
    try {
      const ended = await endEverySession(env.CATALOG_DB, token, Date.now());
      outcome = ended > 0 ? "all" : "here";
    } catch {
      outcome = "failed";
    }
  }
  jar.set(sessionCookieName(env), "", cookieOptions(env, 0));
  if (outcome === "failed") redirect("/sign-in?error=sign-out-all");
  redirect(
    outcome === "all" ? "/sign-in?signed-out=all" : "/sign-in?signed-out=1",
  );
}
