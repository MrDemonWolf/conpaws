import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { type AdminBindings, getAdminContext } from "./db";
import { type AdminRole, isFreshSession, readSession } from "./sign-in";
import { sessionCookieName } from "./sign-in-cookies";

export type { AdminRole } from "./sign-in";

export interface AdminSession {
  email: string;
  role: AdminRole;
  /** When this browser last entered a code; gates team changes. */
  verifiedAt: number;
}

export type AdminGate =
  | { status: "authorized"; session: AdminSession }
  | { status: "identity-required" }
  | { status: "not-provisioned"; email: string }
  | { status: "disabled"; email: string }
  | { status: "unavailable" };

/**
 * Local development only. The address in an ignored `.dev.vars` file acts
 * without a code and, on a local catalog that has no owner yet, becomes its
 * owner once. Production always binds ADMIN_RUNTIME_ENV=production and never
 * ADMIN_DEV_EMAIL, so this path cannot run there.
 */
async function localDevelopmentGate(
  database: D1Database,
  email: string,
  now: number,
): Promise<AdminGate> {
  await database
    .prepare(
      `INSERT OR IGNORE INTO admin_members (email, role, status, created_at, created_by)
       SELECT ?1, 'owner', 'active', ?2, 'local-development'
       WHERE NOT EXISTS (SELECT 1 FROM admin_members WHERE role = 'owner')`,
    )
    .bind(email, now)
    .run();
  const member = await database
    .prepare("SELECT role, status FROM admin_members WHERE email = ?1")
    .bind(email)
    .first<{ role: AdminRole; status: "active" | "disabled" }>();
  if (!member) return { status: "not-provisioned", email };
  if (member.status !== "active") return { status: "disabled", email };
  return {
    status: "authorized",
    session: { email, role: member.role, verifiedAt: now },
  };
}

export async function getAdminGate(): Promise<AdminGate> {
  let env: CloudflareEnv & AdminBindings;
  try {
    env = (await getAdminContext()).env;
  } catch {
    return { status: "unavailable" };
  }
  const database = env.CATALOG_DB;
  if (!database) return { status: "unavailable" };
  const now = Date.now();
  // Read outside the try below: Next signals dynamic rendering by throwing
  // from cookies(), and that must not be swallowed.
  const token = (await cookies()).get(sessionCookieName(env))?.value;

  try {
    const devEmail = env.ADMIN_DEV_EMAIL?.trim().toLowerCase();
    if (env.ADMIN_RUNTIME_ENV === "local" && devEmail) {
      return await localDevelopmentGate(database, devEmail, now);
    }

    if (!token) return { status: "identity-required" };
    const session = await readSession(database, token, now);
    if (!session) return { status: "identity-required" };
    if (!session.role || !session.status) {
      return { status: "not-provisioned", email: session.email };
    }
    if (session.status !== "active") {
      return { status: "disabled", email: session.email };
    }
    return {
      status: "authorized",
      session: {
        email: session.email,
        role: session.role,
        verifiedAt: session.verifiedAt,
      },
    };
  } catch (error) {
    // A missing table or an unreachable database must not look like a
    // signed-out visitor, and must never look like a signed-in one.
    console.error(
      "Admin sign-in check failed:",
      error instanceof Error ? error.message : "unknown error",
    );
    return { status: "unavailable" };
  }
}

/**
 * The gate for every console page and server action. A signed-out visitor is
 * sent to sign in; anyone else without the role is refused. `confirmAt` also
 * requires a code entered recently, for changes that grant or remove access.
 */
export async function requireAdmin(
  minimum: AdminRole = "editor",
  options: { confirmAt?: "/team" } = {},
) {
  const gate = await getAdminGate();
  if (gate.status === "identity-required") redirect("/sign-in");
  if (gate.status !== "authorized") {
    throw new Error(`Admin access denied: ${gate.status}`);
  }
  if (minimum === "owner" && gate.session.role !== "owner") {
    throw new Error("Admin access denied: owner role required");
  }
  if (options.confirmAt && !isFreshSession(gate.session)) {
    redirect(`${options.confirmAt}?confirm=required`);
  }
  return gate.session;
}
