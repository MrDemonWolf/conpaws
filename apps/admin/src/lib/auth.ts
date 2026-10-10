import { createRemoteJWKSet, jwtVerify } from "jose";
import { headers } from "next/headers";
import { type AdminBindings, getAdminBindings, getCatalogDatabase } from "./db";

export type AdminRole = "owner" | "editor";
export interface AdminSession {
  email: string;
  role: AdminRole;
}

export type AdminGate =
  | { status: "authorized"; session: AdminSession }
  | { status: "identity-required" }
  | { status: "not-provisioned"; email: string }
  | { status: "disabled"; email: string }
  | { status: "unavailable" };

const remoteKeys = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

function getAccessIssuer(teamDomain: string) {
  const value = teamDomain
    .trim()
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "");
  if (!value || value.includes("/") || value.includes("@")) return null;
  return `https://${value}`;
}

async function getIdentityEmail(
  requestHeaders: Headers,
): Promise<string | null> {
  let env: AdminBindings;
  try {
    env = await getAdminBindings();
  } catch {
    return null;
  }

  // This identity exists only in a local `.dev.vars` file. The Alchemy
  // production stack never binds ADMIN_DEV_EMAIL or the `local` runtime flag.
  if (env.ADMIN_RUNTIME_ENV === "local" && env.ADMIN_DEV_EMAIL?.trim()) {
    return env.ADMIN_DEV_EMAIL.trim().toLowerCase();
  }

  const token = requestHeaders.get("cf-access-jwt-assertion");
  const issuer = env.CF_ACCESS_TEAM_DOMAIN
    ? getAccessIssuer(env.CF_ACCESS_TEAM_DOMAIN)
    : null;
  const audience = env.CF_ACCESS_AUD?.trim();
  if (!token || !issuer || !audience) return null;

  try {
    let keySet = remoteKeys.get(issuer);
    if (!keySet) {
      keySet = createRemoteJWKSet(new URL("/cdn-cgi/access/certs", issuer));
      remoteKeys.set(issuer, keySet);
    }
    const { payload } = await jwtVerify(token, keySet, {
      issuer,
      audience,
      algorithms: ["RS256"],
    });
    return typeof payload.email === "string"
      ? payload.email.trim().toLowerCase()
      : null;
  } catch {
    return null;
  }
}

/**
 * Who may claim an ownerless catalog. In production that is a member of the
 * Cloudflare account: the deploy binds their emails here and makes them the
 * only people Cloudflare Access lets through, so a stranger who finds
 * admin.conpaws.com first cannot take it over. Locally it is the dev identity.
 */
function canClaimOwnership(env: AdminBindings, email: string) {
  if (env.ADMIN_RUNTIME_ENV === "local") {
    return env.ADMIN_DEV_EMAIL?.trim().toLowerCase() === email;
  }
  return (env.ADMIN_BOOTSTRAP_EMAILS ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean)
    .includes(email);
}

export async function getAdminGate(): Promise<AdminGate> {
  let env: AdminBindings;
  try {
    env = await getAdminBindings();
    if (!env.CATALOG_DB) return { status: "unavailable" };
  } catch {
    return { status: "unavailable" };
  }

  const requestHeaders = await headers();
  const email = await getIdentityEmail(requestHeaders);
  if (!email) return { status: "identity-required" };

  const database = await getCatalogDatabase();

  // First login wins: while the catalog has no owner, the first person to
  // sign in who may claim it becomes the owner, exactly once. Once an owner
  // exists nobody can claim it again, even if that owner is later disabled
  // or removed.
  if (canClaimOwnership(env, email)) {
    await database
      .prepare(
        `INSERT OR IGNORE INTO admin_members (email, role, status, created_at)
         SELECT ?, 'owner', 'active', ?
         WHERE NOT EXISTS (SELECT 1 FROM admin_members WHERE role = 'owner')`,
      )
      .bind(email, Date.now())
      .run();
  }

  const member = await database
    .prepare("SELECT role, status FROM admin_members WHERE email = ?")
    .bind(email)
    .first<{ role: AdminRole; status: "active" | "disabled" }>();

  if (!member) return { status: "not-provisioned", email };
  if (member.status !== "active") return { status: "disabled", email };
  return { status: "authorized", session: { email, role: member.role } };
}

export async function requireAdmin(minimum: AdminRole = "editor") {
  const gate = await getAdminGate();
  if (gate.status !== "authorized") {
    throw new Error(`Admin access denied: ${gate.status}`);
  }
  if (minimum === "owner" && gate.session.role !== "owner") {
    throw new Error("Admin access denied: owner role required");
  }
  return gate.session;
}
