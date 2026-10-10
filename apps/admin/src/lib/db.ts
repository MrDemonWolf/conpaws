import { getCloudflareContext } from "@opennextjs/cloudflare";
import { drizzle } from "drizzle-orm/d1";
import { catalogSchema } from "../db/schema";

export interface AdminBindings {
  CATALOG_DB?: D1Database;
  /** Comma-separated emails allowed to claim an ownerless catalog. */
  ADMIN_BOOTSTRAP_EMAILS?: string;
  ADMIN_DEV_EMAIL?: string;
  ADMIN_RUNTIME_ENV?: "local" | "production";
  CF_ACCESS_TEAM_DOMAIN?: string;
  CF_ACCESS_AUD?: string;
}

export async function getAdminBindings() {
  return (await getCloudflareContext({ async: true })).env as CloudflareEnv &
    AdminBindings;
}

export async function getCatalogDatabase() {
  const binding = (await getAdminBindings()).CATALOG_DB;
  if (!binding) throw new Error("The catalog database binding is missing.");
  return binding;
}

export async function getCatalogDb() {
  return drizzle(await getCatalogDatabase(), { schema: catalogSchema });
}
