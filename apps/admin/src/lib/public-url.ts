import { headers } from "next/headers";
import { getAdminBindings } from "./db";

/**
 * The console's own origin, for links in invite emails and on the Team page.
 * Production uses the value the deploy binds and never a request header, so
 * a forged Host header cannot put another site's address into an invite.
 */
export async function adminPublicUrl() {
  const env = await getAdminBindings();
  const configured = env.ADMIN_PUBLIC_URL?.trim().replace(/\/+$/, "");
  if (configured && /^https?:\/\/[^/\s?#]+$/.test(configured)) {
    return configured;
  }
  if (env.ADMIN_RUNTIME_ENV !== "local") return null;
  const host = (await headers()).get("host");
  return host && /^[A-Za-z0-9.:[\]-]+$/.test(host) ? `http://${host}` : null;
}
