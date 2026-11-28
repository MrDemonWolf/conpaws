"use server";

import type { Route } from "next";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "../../../lib/auth";
import { formString } from "../../../lib/catalog";
import { getCatalogDatabase } from "../../../lib/db";
import { safeNextPath } from "../../../lib/sign-in-cookies";

export async function saveDisplayName(formData: FormData) {
  const actor = await requireAdmin();
  const displayName = formString(formData, "displayName")
    .trim()
    .normalize("NFC");
  const next = safeNextPath(formString(formData, "next"));
  const setup = formString(formData, "setup") === "1";

  if (
    displayName.length < 1 ||
    displayName.length > 80 ||
    /[\p{Cc}\p{Zl}\p{Zp}\p{Bidi_Control}]/u.test(displayName) ||
    !/[\p{L}\p{N}\p{P}\p{S}]/u.test(
      displayName.replace(/\p{Default_Ignorable_Code_Point}/gu, ""),
    )
  ) {
    const search = new URLSearchParams({ error: "name" });
    if (setup) search.set("setup", "1");
    if (next) search.set("next", next);
    redirect(`/account?${search}`);
  }

  const database = await getCatalogDatabase();
  const [, result] = await database.batch([
    database
      .prepare(
        `INSERT INTO audit_log (id, actor_email, action, resource_type, resource_id, summary)
       SELECT ?1, email, 'admin.display-name-changed', 'admin_member', email, 'Updated display name'
       FROM admin_members WHERE email = ?2 AND status = 'active' AND display_name IS NOT ?3`,
      )
      .bind(crypto.randomUUID(), actor.email, displayName),
    database
      .prepare(
        "UPDATE admin_members SET display_name = ?1 WHERE email = ?2 AND status = 'active'",
      )
      .bind(displayName, actor.email),
  ]);
  if (result?.meta.changes !== 1) redirect("/sign-in?error=disabled");
  revalidatePath("/", "layout");
  redirect((next ?? (setup ? "/" : "/account?saved=1")) as Route);
}
