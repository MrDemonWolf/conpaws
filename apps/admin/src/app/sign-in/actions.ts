"use server";

import type { Route } from "next";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { sendAdminEmail, signInCodeEmail } from "../../lib/admin-email";
import { getAdminGate } from "../../lib/auth";
import { formString } from "../../lib/catalog";
import { type AdminBindings, getAdminContext } from "../../lib/db";
import {
  admitMember,
  checkSignInCode,
  endAllSessions,
  endSession,
  issueSignInCode,
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
  normalizeSignInCode,
  randomToken,
} from "../../lib/sign-in-crypto";

/** Long enough to read the email and resend once; the code itself lasts 10 minutes. */
const ATTEMPT_COOKIE_SECONDS = 30 * 60;

/**
 * A coarse per-network limit in front of the database's per-address limits.
 * It fails open: the address limits in D1 are the ones that matter, and a
 * limiter outage should not lock the team out.
 */
async function withinNetworkLimit(
  env: AdminBindings,
  action: "request" | "verify",
) {
  const limiter = env.ADMIN_SIGN_IN_LIMITER;
  if (!limiter) return true;
  const address = (await headers()).get("cf-connecting-ip") ?? "unknown";
  try {
    return (await limiter.limit({ key: `${action}:${address}` })).success;
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

export async function requestSignInCode(formData: FormData) {
  const { env, ctx } = await getAdminContext();
  const resend = formString(formData, "resend") === "1";
  const next = safeNextPath(formString(formData, "next"));
  const parsed = signInEmailSchema.safeParse(formString(formData, "email"));
  if (!parsed.success) redirect("/sign-in?error=email");
  const database = env.CATALOG_DB;
  const secret = signInSecret(env);
  if (!database || !secret) redirect("/sign-in?error=unavailable");
  if (!(await withinNetworkLimit(env, "request"))) {
    redirect(resend ? "/sign-in/code?error=rate" : "/sign-in?error=rate");
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
  const work = issueSignInCode({
    database,
    secret,
    attemptId,
    email,
    now: Date.now(),
    deliver: (code) => deliverCode(env, email, code),
  }).catch((error: unknown) => {
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
  if (check.status !== "valid") redirect(`/sign-in/code?error=${check.status}`);

  // The code proved the address. Who it belongs to comes from the code's row,
  // never from the cookie.
  jar.set(attemptCookieName(env), "", cookieOptions(env, 0));
  const admission = await admitMember({ database, email: check.email, now });
  if (admission.status === "disabled") redirect("/sign-in?error=disabled");
  if (admission.status !== "member") redirect("/sign-in?error=denied");

  const token = await startSession({
    database,
    email: check.email,
    now,
    replacingToken: jar.get(sessionCookieName(env))?.value,
  });
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
  if (token && env.CATALOG_DB) await endSession(env.CATALOG_DB, token);
  jar.set(sessionCookieName(env), "", cookieOptions(env, 0));
  redirect("/sign-in?signed-out=1");
}

/** Ends every session for the signed-in address, on every device. */
export async function signOutEverywhere() {
  const { env } = await getAdminContext();
  const gate = await getAdminGate();
  if (gate.status === "authorized" && env.CATALOG_DB) {
    await endAllSessions(env.CATALOG_DB, gate.session.email);
  }
  const jar = await cookies();
  jar.set(sessionCookieName(env), "", cookieOptions(env, 0));
  redirect("/sign-in?signed-out=all");
}
