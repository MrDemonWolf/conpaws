"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { inviteEmail, sendAdminEmail } from "../../lib/admin-email";
import { auditStatement } from "../../lib/audit";
import { requireAdmin } from "../../lib/auth";
import {
  conventionInputSchema,
  formString,
  getPublicationIssues,
  memberInputSchema,
  publicConventionSchema,
  scheduleEventInputSchema,
  todayInTimezone,
} from "../../lib/catalog";
import { getAdminBindings, getCatalogDatabase } from "../../lib/db";
import { adminPublicUrl } from "../../lib/public-url";
import { buildPublicSnapshot, getConventionWorkspace } from "../../lib/queries";
import { SIGN_IN_POLICY } from "../../lib/sign-in";

function conventionValues(formData: FormData) {
  return conventionInputSchema.safeParse({
    name: formString(formData, "name"),
    acronym: formString(formData, "acronym"),
    slug: formString(formData, "slug"),
    city: formString(formData, "city"),
    region: formString(formData, "region"),
    country: formString(formData, "country"),
    startsOn: formString(formData, "startsOn"),
    endsOn: formString(formData, "endsOn"),
    timezone: formString(formData, "timezone"),
    venue: formString(formData, "venue"),
    officialUrl: formString(formData, "officialUrl"),
    availability: formString(formData, "availability") || "unknown",
    scheduleStatus: formString(formData, "scheduleStatus") || "not-released",
    sourceVerifiedAt: formString(formData, "sourceVerifiedAt"),
  });
}

function eventValues(formData: FormData) {
  return scheduleEventInputSchema.safeParse({
    title: formString(formData, "title"),
    description: formString(formData, "description"),
    room: formString(formData, "room"),
    startsAt: formString(formData, "startsAt"),
    endsAt: formString(formData, "endsAt"),
    status: formString(formData, "status") || "scheduled",
  });
}

function nextTimestamp(expected: number) {
  return Math.max(Date.now(), expected + 1);
}

export async function createConvention(formData: FormData) {
  const actor = await requireAdmin();
  const parsed = conventionValues(formData);
  if (!parsed.success) {
    const field = String(parsed.error.issues[0]?.path[0] ?? "");
    const message = parsed.error.issues[0]?.message ?? "Check this value.";
    redirect(
      `/conventions/new?error=invalid${field ? `&field=${field}&message=${encodeURIComponent(message)}` : ""}`,
    );
  }

  const values = parsed.data;
  const database = await getCatalogDatabase();
  const existing = await database
    .prepare("SELECT id FROM conventions WHERE slug = ?")
    .bind(values.slug)
    .first();
  if (existing) redirect("/conventions/new?error=slug");

  const id = crypto.randomUUID();
  const now = Date.now();
  try {
    await database.batch([
      database
        .prepare(
          `INSERT INTO conventions (
            id, slug, name, acronym, city, region, country, starts_on, ends_on,
            timezone, venue, official_url, availability, schedule_status,
            source_verified_at, status, created_by, updated_by,
            created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?)`,
        )
        .bind(
          id,
          values.slug,
          values.name,
          values.acronym,
          values.city,
          values.region,
          values.country,
          values.startsOn,
          values.endsOn,
          values.timezone,
          values.venue,
          values.officialUrl,
          values.availability,
          values.scheduleStatus,
          values.sourceVerifiedAt,
          actor.email,
          actor.email,
          now,
          now,
        ),
      auditStatement(database, {
        actor: actor.email,
        action: "convention.created",
        resourceType: "convention",
        resourceId: id,
        summary: `Created ${values.name} as a draft`,
      }),
    ]);
  } catch {
    redirect("/conventions/new?error=slug");
  }

  revalidatePath("/");
  revalidatePath("/conventions");
  redirect(`/conventions/${id}`);
}

export async function updateConvention(formData: FormData) {
  const actor = await requireAdmin();
  const id = formString(formData, "id");
  const expectedUpdatedAt = Number(formString(formData, "updatedAt"));
  const parsed = conventionValues(formData);
  if (!parsed.success || !Number.isFinite(expectedUpdatedAt)) {
    const field = parsed.success
      ? ""
      : String(parsed.error.issues[0]?.path[0] ?? "");
    const message = parsed.success
      ? ""
      : (parsed.error.issues[0]?.message ?? "Check this value.");
    redirect(
      `/conventions/${id}?error=invalid${field ? `&field=${field}&message=${encodeURIComponent(message)}` : ""}`,
    );
  }

  const values = parsed.data;
  const database = await getCatalogDatabase();
  const outOfRangeEvent = await database
    .prepare(
      `SELECT id FROM schedule_events
       WHERE convention_id = ?
         AND (substr(starts_at, 1, 10) < ? OR substr(ends_at, 1, 10) > ?)
       LIMIT 1`,
    )
    .bind(id, values.startsOn, values.endsOn)
    .first();
  if (outOfRangeEvent) redirect(`/conventions/${id}?error=date-range`);
  const duplicate = await database
    .prepare("SELECT id FROM conventions WHERE slug = ? AND id != ?")
    .bind(values.slug, id)
    .first();
  if (duplicate) redirect(`/conventions/${id}?error=slug`);

  const result = await database.batch([
    database
      .prepare(
        `UPDATE conventions SET
            slug = ?, name = ?, acronym = ?, city = ?, region = ?, country = ?,
            starts_on = ?, ends_on = ?, timezone = ?, venue = ?, official_url = ?,
            availability = ?, schedule_status = ?, source_verified_at = ?,
            updated_by = ?, updated_at = ?
           WHERE id = ? AND updated_at = ?`,
      )
      .bind(
        values.slug,
        values.name,
        values.acronym,
        values.city,
        values.region,
        values.country,
        values.startsOn,
        values.endsOn,
        values.timezone,
        values.venue,
        values.officialUrl,
        values.availability,
        values.scheduleStatus,
        values.sourceVerifiedAt,
        actor.email,
        nextTimestamp(expectedUpdatedAt),
        id,
        expectedUpdatedAt,
      ),
    database
      .prepare(
        `INSERT INTO audit_log (id, actor_email, action, resource_type, resource_id, summary)
           SELECT ?, ?, 'convention.updated', 'convention', ?, ? WHERE changes() = 1`,
      )
      .bind(crypto.randomUUID(), actor.email, id, `Updated ${values.name}`),
  ]);
  if (result[0]?.meta.changes !== 1)
    redirect(`/conventions/${id}?error=conflict`);
  revalidatePath("/");
  revalidatePath("/conventions");
  revalidatePath(`/conventions/${id}`);
  redirect(`/conventions/${id}?saved=details`);
}

export async function createScheduleEvent(formData: FormData) {
  const actor = await requireAdmin();
  const conventionId = formString(formData, "conventionId");
  const expectedUpdatedAt = Number(formString(formData, "updatedAt"));
  const parsed = eventValues(formData);
  if (!parsed.success || !Number.isFinite(expectedUpdatedAt)) {
    const field = parsed.success
      ? ""
      : String(parsed.error.issues[0]?.path[0] ?? "");
    const message = parsed.success
      ? ""
      : (parsed.error.issues[0]?.message ?? "Check this value.");
    redirect(
      `/conventions/${conventionId}?error=invalid-event${field ? `&field=${field}&message=${encodeURIComponent(message)}` : ""}`,
    );
  }

  const workspace = await getConventionWorkspace(conventionId);
  if (!workspace) redirect("/conventions?error=missing");
  const eventDay = parsed.data.startsAt.slice(0, 10);
  const lastEventDay = parsed.data.endsAt.slice(0, 10);
  if (
    eventDay < workspace.convention.startsOn ||
    eventDay > workspace.convention.endsOn ||
    lastEventDay > workspace.convention.endsOn
  ) {
    redirect(`/conventions/${conventionId}?error=event-date`);
  }

  const database = await getCatalogDatabase();
  const eventId = crypto.randomUUID();
  const now = nextTimestamp(expectedUpdatedAt);
  const result = await database.batch([
    database
      .prepare(
        `INSERT INTO schedule_events (
          id, convention_id, title, description, room, starts_at, ends_at,
          status, updated_by, updated_at
        ) SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
          FROM conventions WHERE id = ? AND updated_at = ?`,
      )
      .bind(
        eventId,
        conventionId,
        parsed.data.title,
        parsed.data.description,
        parsed.data.room,
        parsed.data.startsAt,
        parsed.data.endsAt,
        parsed.data.status,
        actor.email,
        now,
        conventionId,
        expectedUpdatedAt,
      ),
    database
      .prepare(
        `UPDATE conventions SET updated_at = ?, updated_by = ?
         WHERE id = ? AND updated_at = ?
           AND EXISTS (SELECT 1 FROM schedule_events WHERE id = ?)`,
      )
      .bind(now, actor.email, conventionId, expectedUpdatedAt, eventId),
    database
      .prepare(
        `INSERT INTO audit_log (id, actor_email, action, resource_type, resource_id, summary)
         SELECT ?, ?, 'schedule_event.created', 'convention', ?, ?
         WHERE EXISTS (SELECT 1 FROM conventions WHERE id = ? AND updated_at = ?)`,
      )
      .bind(
        crypto.randomUUID(),
        actor.email,
        conventionId,
        `Added “${parsed.data.title}” to ${workspace.convention.name}`,
        conventionId,
        now,
      ),
  ]);

  if (result[0]?.meta.changes !== 1) {
    redirect(`/conventions/${conventionId}?error=conflict`);
  }
  revalidatePath(`/conventions/${conventionId}`);
  revalidatePath("/");
  redirect(`/conventions/${conventionId}?saved=session`);
}

export async function updateScheduleEvent(formData: FormData) {
  const actor = await requireAdmin();
  const conventionId = formString(formData, "conventionId");
  const eventId = formString(formData, "eventId");
  const expectedEventUpdatedAt = Number(formString(formData, "eventUpdatedAt"));
  const expectedConventionUpdatedAt = Number(
    formString(formData, "conventionUpdatedAt"),
  );
  const parsed = eventValues(formData);
  if (
    !parsed.success ||
    !Number.isFinite(expectedEventUpdatedAt) ||
    !Number.isFinite(expectedConventionUpdatedAt)
  ) {
    const field = parsed.success
      ? ""
      : String(parsed.error.issues[0]?.path[0] ?? "");
    const message = parsed.success
      ? ""
      : (parsed.error.issues[0]?.message ?? "Check this value.");
    redirect(
      `/conventions/${conventionId}?error=invalid-event${field ? `&field=${field}&message=${encodeURIComponent(message)}` : ""}`,
    );
  }

  const workspace = await getConventionWorkspace(conventionId);
  if (!workspace) redirect("/conventions?error=missing");
  const eventDay = parsed.data.startsAt.slice(0, 10);
  const lastEventDay = parsed.data.endsAt.slice(0, 10);
  if (
    eventDay < workspace.convention.startsOn ||
    eventDay > workspace.convention.endsOn ||
    lastEventDay > workspace.convention.endsOn
  ) {
    redirect(`/conventions/${conventionId}?error=event-date`);
  }

  const database = await getCatalogDatabase();
  const now = nextTimestamp(expectedConventionUpdatedAt);
  const results = await database.batch([
    database
      .prepare(
        `UPDATE schedule_events SET
           title = ?, description = ?, room = ?, starts_at = ?, ends_at = ?,
           status = ?, updated_by = ?, updated_at = ?
         WHERE id = ? AND convention_id = ? AND updated_at = ?
           AND EXISTS (
             SELECT 1 FROM conventions
             WHERE id = ? AND updated_at = ?
           )`,
      )
      .bind(
        parsed.data.title,
        parsed.data.description,
        parsed.data.room,
        parsed.data.startsAt,
        parsed.data.endsAt,
        parsed.data.status,
        actor.email,
        now,
        eventId,
        conventionId,
        expectedEventUpdatedAt,
        conventionId,
        expectedConventionUpdatedAt,
      ),
    database
      .prepare(
        `UPDATE conventions SET updated_at = ?, updated_by = ?
         WHERE id = ? AND updated_at = ?
           AND EXISTS (
             SELECT 1 FROM schedule_events
             WHERE id = ? AND updated_at = ?
           )`,
      )
      .bind(
        now,
        actor.email,
        conventionId,
        expectedConventionUpdatedAt,
        eventId,
        now,
      ),
    database
      .prepare(
        `INSERT INTO audit_log (id, actor_email, action, resource_type, resource_id, summary)
         SELECT ?, ?, 'schedule_event.updated', 'convention', ?, ?
         WHERE EXISTS (SELECT 1 FROM conventions WHERE id = ? AND updated_at = ?)`,
      )
      .bind(
        crypto.randomUUID(),
        actor.email,
        conventionId,
        `Updated “${parsed.data.title}” in ${workspace.convention.name}`,
        conventionId,
        now,
      ),
  ]);

  if (results[0]?.meta.changes !== 1) {
    redirect(`/conventions/${conventionId}?error=conflict`);
  }
  revalidatePath(`/conventions/${conventionId}`);
  revalidatePath("/");
  redirect(`/conventions/${conventionId}?saved=session`);
}

export async function publishConvention(formData: FormData) {
  const actor = await requireAdmin();
  const id = formString(formData, "id");
  const expectedUpdatedAt = Number(formString(formData, "updatedAt"));
  const expectedRevision = Number(formString(formData, "publishedRevision"));
  const summary = formString(formData, "summary");
  if (
    !Number.isFinite(expectedUpdatedAt) ||
    !Number.isInteger(expectedRevision) ||
    expectedRevision < 0 ||
    summary.length < 5 ||
    summary.length > 200
  ) {
    redirect(`/conventions/${id}?error=publish-invalid`);
  }

  const workspace = await getConventionWorkspace(id);
  if (!workspace) redirect("/conventions?error=missing");
  const convention = conventionInputSchema.safeParse({
    name: workspace.convention.name,
    acronym: workspace.convention.acronym,
    slug: workspace.convention.slug,
    city: workspace.convention.city,
    region: workspace.convention.region,
    country: workspace.convention.country,
    startsOn: workspace.convention.startsOn,
    endsOn: workspace.convention.endsOn,
    timezone: workspace.convention.timezone,
    venue: workspace.convention.venue,
    officialUrl: workspace.convention.officialUrl,
    availability: workspace.convention.availability,
    scheduleStatus: workspace.convention.scheduleStatus,
    sourceVerifiedAt: workspace.convention.sourceVerifiedAt,
  });
  const parsedSessions = workspace.sessions.map((session) =>
    scheduleEventInputSchema.safeParse(session),
  );
  const validSessions = parsedSessions.flatMap((session) =>
    session.success ? [session.data] : [],
  );
  const today = todayInTimezone(
    convention.success ? convention.data.timezone : "UTC",
  );
  const issues =
    convention.success && validSessions.length === workspace.sessions.length
      ? getPublicationIssues({
          convention: convention.data,
          sessions: validSessions,
          today,
        })
      : ["Review the convention and schedule fields before publishing."];
  if (
    !convention.success ||
    validSessions.length !== workspace.sessions.length ||
    issues.length
  ) {
    redirect(`/conventions/${id}?error=publish-validation`);
  }
  const previousRevision = workspace.revisions.find(
    (revision) => revision.revision === expectedRevision,
  );
  if (
    previousRevision &&
    previousRevision.snapshotJson ===
      JSON.stringify(
        buildPublicSnapshot({
          convention: workspace.convention,
          sessions: workspace.sessions,
          revision: expectedRevision,
        }),
      )
  ) {
    redirect(`/conventions/${id}?error=no-changes`);
  }
  const nextRevision = expectedRevision + 1;
  const snapshot = buildPublicSnapshot({
    convention: workspace.convention,
    sessions: workspace.sessions,
    revision: nextRevision,
  });
  const database = await getCatalogDatabase();
  const revisionId = crypto.randomUUID();
  const now = nextTimestamp(expectedUpdatedAt);
  const results = await database.batch([
    database
      .prepare(
        `INSERT INTO convention_revisions (
          id, convention_id, revision, snapshot_json, source_url,
          source_verified_at, summary, actor_email, created_at
        ) SELECT ?, c.id, ?, ?, c.official_url, c.source_verified_at, ?, ?, ?
          FROM conventions c
         WHERE c.id = ? AND c.updated_at = ?
           AND COALESCE(c.published_revision, 0) = ?
           AND ? = COALESCE(
             (SELECT MAX(revision) FROM convention_revisions WHERE convention_id = c.id),
             0
           )`,
      )
      .bind(
        revisionId,
        nextRevision,
        JSON.stringify(snapshot),
        summary,
        actor.email,
        now,
        id,
        expectedUpdatedAt,
        expectedRevision,
        expectedRevision,
      ),
    database
      .prepare(
        `UPDATE conventions SET published_slug = NULL
         WHERE published_slug = ? AND id <> ?
           AND EXISTS (SELECT 1 FROM conventions
             WHERE id = ? AND updated_at = ? AND COALESCE(published_revision, 0) = ?
               AND EXISTS (SELECT 1 FROM convention_revisions WHERE id = ?))`,
      )
      .bind(
        snapshot.slug,
        id,
        id,
        expectedUpdatedAt,
        expectedRevision,
        revisionId,
      ),
    database
      .prepare(
        `UPDATE conventions
         SET status = 'published', published_revision = ?, published_slug = ?, updated_by = ?, updated_at = ?
         WHERE id = ? AND updated_at = ? AND COALESCE(published_revision, 0) = ?
           AND EXISTS (SELECT 1 FROM convention_revisions WHERE id = ?)`,
      )
      .bind(
        nextRevision,
        snapshot.slug,
        actor.email,
        now,
        id,
        expectedUpdatedAt,
        expectedRevision,
        revisionId,
      ),
    database
      .prepare(
        `INSERT INTO audit_log (id, actor_email, action, resource_type, resource_id, summary)
         SELECT ?, ?, 'convention.published', 'convention', ?, ?
         WHERE EXISTS (
           SELECT 1 FROM conventions
           WHERE id = ? AND published_revision = ? AND updated_at = ?
         )`,
      )
      .bind(
        crypto.randomUUID(),
        actor.email,
        id,
        `Published ${workspace.convention.name} revision ${nextRevision}`,
        id,
        nextRevision,
        now,
      ),
  ]);

  if (results[2]?.meta.changes !== 1) {
    redirect(`/conventions/${id}?error=conflict`);
  }
  revalidatePath("/");
  revalidatePath("/conventions");
  revalidatePath(`/conventions/${id}`);
  redirect(`/conventions/${id}?published=${nextRevision}`);
}

export async function restoreRevision(formData: FormData) {
  const actor = await requireAdmin();
  const id = formString(formData, "id");
  const targetRevision = Number(formString(formData, "revision"));
  const expectedUpdatedAt = Number(formString(formData, "updatedAt"));
  const expectedRevision = Number(formString(formData, "publishedRevision"));
  if (
    !Number.isInteger(targetRevision) ||
    targetRevision < 1 ||
    !Number.isFinite(expectedUpdatedAt) ||
    !Number.isInteger(expectedRevision) ||
    expectedRevision < 1 ||
    targetRevision === expectedRevision
  ) {
    redirect(`/conventions/${id}?error=restore-invalid`);
  }

  const database = await getCatalogDatabase();
  const prior = await database
    .prepare(
      `SELECT revision, snapshot_json, source_url, source_verified_at
         FROM convention_revisions
        WHERE convention_id = ? AND revision = ?`,
    )
    .bind(id, targetRevision)
    .first<{
      revision: number;
      snapshot_json: string;
      source_url: string;
      source_verified_at: string;
    }>();
  if (!prior) redirect(`/conventions/${id}?error=restore-invalid`);

  let rawSnapshot: unknown;
  try {
    rawSnapshot = JSON.parse(prior.snapshot_json);
  } catch {
    redirect(`/conventions/${id}?error=restore-invalid`);
  }
  const snapshotResult = publicConventionSchema.safeParse(rawSnapshot);
  if (!snapshotResult.success || snapshotResult.data.id !== id) {
    redirect(`/conventions/${id}?error=restore-invalid`);
  }
  const snapshot = snapshotResult.data;
  const convention = conventionInputSchema.safeParse({
    name: snapshot.name,
    acronym: snapshot.acronym,
    slug: snapshot.slug,
    city: snapshot.city,
    region: snapshot.region,
    country: snapshot.country,
    startsOn: snapshot.startsOn,
    endsOn: snapshot.endsOn,
    timezone: snapshot.timezone,
    venue: snapshot.venue,
    officialUrl: prior.source_url,
    availability: snapshot.availability,
    scheduleStatus: snapshot.scheduleStatus,
    sourceVerifiedAt: prior.source_verified_at,
  });
  const parsedSessions = snapshot.sessions.map((session) =>
    scheduleEventInputSchema.safeParse(session),
  );
  const validSessions = parsedSessions.flatMap((session) =>
    session.success ? [session.data] : [],
  );
  const issues =
    convention.success && validSessions.length === snapshot.sessions.length
      ? getPublicationIssues({
          convention: convention.data,
          sessions: validSessions,
          today: todayInTimezone(convention.data.timezone),
        })
      : ["The saved revision cannot be restored because its data is invalid."];
  if (issues.length) redirect(`/conventions/${id}?error=restore-invalid`);
  if (!convention.success) redirect(`/conventions/${id}?error=restore-invalid`);

  const values = convention.data;
  const nextRevision = expectedRevision + 1;
  const revisionId = crypto.randomUUID();
  const now = nextTimestamp(expectedUpdatedAt);
  const restoredSnapshot = { ...snapshot, revision: nextRevision };
  const statements = [
    database
      .prepare(
        `INSERT INTO convention_revisions (
           id, convention_id, revision, snapshot_json, source_url,
           source_verified_at, summary, actor_email, created_at
         ) SELECT ?, c.id, ?, ?, ?, ?, ?, ?, ?
           FROM conventions c
          WHERE c.id = ? AND c.updated_at = ?
            AND COALESCE(c.published_revision, 0) = ?
            AND ? = COALESCE(
              (SELECT MAX(revision) FROM convention_revisions WHERE convention_id = c.id),
              0
            )
            AND EXISTS (
              SELECT 1 FROM convention_revisions
               WHERE convention_id = c.id AND revision = ?
            )`,
      )
      .bind(
        revisionId,
        nextRevision,
        JSON.stringify(restoredSnapshot),
        prior.source_url,
        prior.source_verified_at,
        `Restored revision v${targetRevision}`,
        actor.email,
        now,
        id,
        expectedUpdatedAt,
        expectedRevision,
        expectedRevision,
        targetRevision,
      ),
    database
      .prepare(
        `UPDATE conventions SET published_slug = NULL
         WHERE published_slug = ? AND id <> ?
           AND EXISTS (SELECT 1 FROM conventions
             WHERE id = ? AND updated_at = ? AND COALESCE(published_revision, 0) = ?
               AND EXISTS (SELECT 1 FROM convention_revisions WHERE id = ?))`,
      )
      .bind(
        values.slug,
        id,
        id,
        expectedUpdatedAt,
        expectedRevision,
        revisionId,
      ),
    database
      .prepare(
        `UPDATE conventions SET
           slug = ?, name = ?, acronym = ?, city = ?, region = ?, country = ?,
           starts_on = ?, ends_on = ?, timezone = ?, venue = ?, official_url = ?,
           availability = ?, schedule_status = ?, source_verified_at = ?,
           status = 'published', published_revision = ?, published_slug = ?, updated_by = ?, updated_at = ?
         WHERE id = ? AND updated_at = ? AND COALESCE(published_revision, 0) = ?
           AND EXISTS (SELECT 1 FROM convention_revisions WHERE id = ?)`,
      )
      .bind(
        values.slug,
        values.name,
        values.acronym,
        values.city,
        values.region,
        values.country,
        values.startsOn,
        values.endsOn,
        values.timezone,
        values.venue,
        values.officialUrl,
        values.availability,
        values.scheduleStatus,
        values.sourceVerifiedAt,
        nextRevision,
        values.slug,
        actor.email,
        now,
        id,
        expectedUpdatedAt,
        expectedRevision,
        revisionId,
      ),
    database
      .prepare(
        `DELETE FROM schedule_events WHERE convention_id = ?
         AND EXISTS (SELECT 1 FROM conventions
           WHERE id = ? AND published_revision = ? AND updated_at = ?)`,
      )
      .bind(id, id, nextRevision, now),
    ...snapshot.sessions.map((session) =>
      database
        .prepare(
          `INSERT INTO schedule_events (
             id, convention_id, title, description, room, starts_at, ends_at,
             status, updated_by, updated_at
           ) SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
             FROM conventions WHERE id = ? AND published_revision = ? AND updated_at = ?`,
        )
        .bind(
          session.id,
          id,
          session.title,
          session.description,
          session.room,
          session.startsAt,
          session.endsAt,
          session.status,
          actor.email,
          now,
          id,
          nextRevision,
          now,
        ),
    ),
    database
      .prepare(
        `INSERT INTO audit_log (id, actor_email, action, resource_type, resource_id, summary)
         SELECT ?, ?, 'convention.restored', 'convention', ?, ?
          WHERE EXISTS (SELECT 1 FROM conventions
             WHERE id = ? AND published_revision = ? AND updated_at = ?)`,
      )
      .bind(
        crypto.randomUUID(),
        actor.email,
        id,
        `Restored ${snapshot.name} from revision v${targetRevision} as v${nextRevision}`,
        id,
        nextRevision,
        now,
      ),
  ];
  const results = await database.batch(statements);
  if (results[2]?.meta.changes !== 1) {
    redirect(`/conventions/${id}?error=restore-conflict`);
  }
  revalidatePath("/");
  revalidatePath("/conventions");
  revalidatePath(`/conventions/${id}`);
  redirect(`/conventions/${id}?restored=${nextRevision}`);
}

/**
 * Emails an invite. Returns whether Email Service accepted it. The link puts
 * the address after `#`, so opening it never sends the address to the
 * Worker or its request logs.
 */
async function sendInvite(input: {
  email: string;
  role: "owner" | "editor";
  invitedBy: string;
  expiresAt: number;
}) {
  const env = await getAdminBindings();
  const base = await adminPublicUrl();
  return sendAdminEmail(
    env,
    inviteEmail({
      to: input.email,
      role: input.role,
      invitedBy: input.invitedBy,
      expiresAt: input.expiresAt,
      signInUrl: base
        ? `${base}/sign-in#email=${encodeURIComponent(input.email)}`
        : null,
    }),
  );
}

/**
 * Invites someone by email. They become a member the first time they sign in
 * with a code, with the role chosen here. Inviting an address again renews
 * the invite and updates its role. Members are managed in the list instead,
 * so an invite can never re-enable a disabled account.
 */
export async function inviteAdmin(formData: FormData) {
  const actor = await requireAdmin("owner", { confirmAt: "/team" });
  const parsed = memberInputSchema.safeParse({
    email: formString(formData, "email"),
    role: formString(formData, "role"),
  });
  if (!parsed.success) redirect("/team?error=invalid");
  const { email, role } = parsed.data;

  const database = await getCatalogDatabase();
  const now = Date.now();
  const expiresAt = now + SIGN_IN_POLICY.inviteLifetimeMs;
  const [saved] = await database.batch([
    database
      .prepare(
        `INSERT INTO admin_invites (email, role, invited_by, created_at, expires_at)
         SELECT ?1, ?2, ?3, ?4, ?5
         WHERE NOT EXISTS (SELECT 1 FROM admin_members WHERE email = ?1)
         ON CONFLICT(email) DO UPDATE SET
           role = excluded.role,
           invited_by = excluded.invited_by,
           created_at = excluded.created_at,
           expires_at = excluded.expires_at`,
      )
      .bind(email, role, actor.email, now, expiresAt),
    database
      .prepare(
        `INSERT INTO audit_log (id, actor_email, action, resource_type, resource_id, summary)
         SELECT ?1, ?2, 'admin.invited', 'admin_invite', ?3, ?4 WHERE changes() = 1`,
      )
      .bind(
        crypto.randomUUID(),
        actor.email,
        email,
        `Invited ${email} as ${role}`,
      ),
  ]);
  if (saved?.meta.changes !== 1) redirect("/team?error=member");

  const sent = await sendInvite({
    email,
    role,
    invitedBy: actor.email,
    expiresAt,
  });
  revalidatePath("/team");
  redirect(sent ? "/team?saved=invite" : "/team?saved=invite-unsent");
}

/** Renews an invite for another seven days and emails it again. */
export async function resendAdminInvite(formData: FormData) {
  const actor = await requireAdmin("owner", { confirmAt: "/team" });
  const email = formString(formData, "email").toLowerCase();
  if (!email) redirect("/team?error=invalid");

  const database = await getCatalogDatabase();
  const now = Date.now();
  const expiresAt = now + SIGN_IN_POLICY.inviteLifetimeMs;
  const invite = await database
    .prepare(
      `UPDATE admin_invites
       SET invited_by = ?2, created_at = ?3, expires_at = ?4
       WHERE email = ?1
       RETURNING role`,
    )
    .bind(email, actor.email, now, expiresAt)
    .first<{ role: "owner" | "editor" }>();
  if (!invite) redirect("/team?error=invite-missing");
  await auditStatement(database, {
    actor: actor.email,
    action: "admin.invite-resent",
    resourceType: "admin_invite",
    resourceId: email,
    summary: `Sent ${email} a new invite`,
  }).run();

  const sent = await sendInvite({
    email,
    role: invite.role,
    invitedBy: actor.email,
    expiresAt,
  });
  revalidatePath("/team");
  redirect(sent ? "/team?saved=invite" : "/team?saved=invite-unsent");
}

/** Withdraws an invite. Any code already sent for it stops working too. */
export async function revokeAdminInvite(formData: FormData) {
  const actor = await requireAdmin("owner", { confirmAt: "/team" });
  const email = formString(formData, "email").toLowerCase();
  if (!email) redirect("/team?error=invalid");

  const database = await getCatalogDatabase();
  const now = Date.now();
  await database.batch([
    database.prepare("DELETE FROM admin_invites WHERE email = ?1").bind(email),
    database
      .prepare(
        `INSERT INTO audit_log (id, actor_email, action, resource_type, resource_id, summary)
         SELECT ?1, ?2, 'admin.invite-revoked', 'admin_invite', ?3, ?4 WHERE changes() = 1`,
      )
      .bind(
        crypto.randomUUID(),
        actor.email,
        email,
        `Withdrew the invite for ${email}`,
      ),
    database
      .prepare(
        `UPDATE admin_sign_in_codes SET consumed_at = ?1
         WHERE email = ?2 AND consumed_at IS NULL
           AND NOT EXISTS (SELECT 1 FROM admin_members WHERE email = ?2)`,
      )
      .bind(now, email),
  ]);
  revalidatePath("/team");
  redirect("/team?saved=revoked");
}

export async function updateAdminRole(formData: FormData) {
  const actor = await requireAdmin("owner", { confirmAt: "/team" });
  const email = formString(formData, "email").toLowerCase();
  const role = formString(formData, "role");
  const status = formString(formData, "status");
  if (
    !email ||
    (role !== "owner" && role !== "editor") ||
    (status !== "active" && status !== "disabled")
  ) {
    redirect("/team?error=invalid");
  }
  if (email === actor.email && (role !== "owner" || status !== "active")) {
    redirect("/team?error=self");
  }

  const database = await getCatalogDatabase();
  const result = await database.batch([
    database
      .prepare(
        `UPDATE admin_members
         SET role = ?, status = ?
         WHERE email = ?
           AND (
             role != 'owner'
             OR status != 'active'
             OR (? = 'owner' AND ? = 'active')
             OR (SELECT COUNT(*) FROM admin_members WHERE role = 'owner' AND status = 'active') > 1
           )`,
      )
      .bind(role, status, email, role, status),
    database
      .prepare(
        `INSERT INTO audit_log (id, actor_email, action, resource_type, resource_id, summary)
         SELECT ?, ?, 'admin.role-updated', 'admin_member', ?, ? WHERE changes() = 1`,
      )
      .bind(
        crypto.randomUUID(),
        actor.email,
        email,
        `Set ${email} to ${status} ${role}`,
      ),
    // Turning someone off signs them out everywhere at once, rather than
    // leaving a session that is refused on each request.
    database
      .prepare(
        `DELETE FROM admin_sessions
         WHERE email = ?1
           AND EXISTS (SELECT 1 FROM admin_members WHERE email = ?1 AND status = 'disabled')`,
      )
      .bind(email),
  ]);
  if (result[0]?.meta.changes !== 1) redirect("/team?error=last-owner");
  revalidatePath("/team");
  redirect("/team?saved=role");
}
