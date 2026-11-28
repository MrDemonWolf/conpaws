"use server";

import type { Route } from "next";
import { redirect } from "next/navigation";
import { requireAdmin } from "../../../lib/auth";
import { formString } from "../../../lib/catalog";
import { getCatalogDatabase } from "../../../lib/db";
import { safeNextPath } from "../../../lib/sign-in-cookies";

export async function saveDisplayName(formData: FormData) {
  const actor = await requireAdmin();
  const displayName = formString(formData, "displayName").trim();
  const next = safeNextPath(formString(formData, "next"));
  const setup = formString(formData, "setup") === "1";

  if (
    displayName.length < 1 ||
    displayName.length > 80 ||
    /\p{Cc}/u.test(displayName)
  ) {
    const search = new URLSearchParams({ error: "name" });
    if (setup) search.set("setup", "1");
    if (next) search.set("next", next);
    redirect(`/account?${search}`);
  }

  const database = await getCatalogDatabase();
  const result = await database
    .prepare(
      "UPDATE admin_members SET display_name = ?1 WHERE email = ?2 AND status = 'active'",
    )
    .bind(displayName, actor.email)
    .run();
  if (result.meta.changes !== 1) redirect("/sign-in?error=disabled");
  redirect((next ?? (setup ? "/" : "/account?saved=1")) as Route);
}
