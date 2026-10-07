import { notFound } from "next/navigation";
import { Icon } from "../../../../components/icons";
import {
  Banner,
  Button,
  Field,
  formatDate,
  formatMoment,
  PageHeading,
  SelectField,
  StatusPill,
  Surface,
  TextAreaField,
} from "../../../../components/ui";
import { requireAdmin } from "../../../../lib/auth";
import {
  availabilityLabels,
  availabilityOptions,
  getPublicationIssues,
  getSnapshotChanges,
  publicConventionSchema,
  scheduleStatusLabels,
  scheduleStatusOptions,
  todayInTimezone,
} from "../../../../lib/catalog";
import {
  buildPublicSnapshot,
  getConventionWorkspace,
} from "../../../../lib/queries";
import {
  createScheduleEvent,
  publishConvention,
  restoreRevision,
  updateConvention,
  updateScheduleEvent,
} from "../../actions";

const errorMessages: Record<string, string> = {
  conflict:
    "Someone else changed this convention first. Reloaded data is shown below; review it and try again.",
  "event-date": "A schedule entry must fall within the convention dates.",
  "date-range":
    "Convention dates cannot exclude existing sessions. Move or remove those sessions first.",
  "invalid-event": "Check the event fields and try again.",
  invalid: "Check the convention fields and try again.",
  "publish-invalid": "Add a short change summary before publishing.",
  "publish-validation":
    "Resolve the publication checklist below before publishing this revision.",
  "no-changes":
    "This draft already matches the live revision. Make a change before publishing again.",
  "restore-invalid":
    "That revision cannot be restored. Check its source verification and schedule data.",
  "restore-conflict":
    "This convention changed while you were restoring. Reload and try again.",
};

function dateTime(value: string) {
  return value.replace("T", " ");
}

function parseRevisionSnapshot(json: string) {
  try {
    const parsed = publicConventionSchema.safeParse(
      JSON.parse(json) as unknown,
    );
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export default async function ConventionWorkspacePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const workspace = await getConventionWorkspace(id);
  if (!workspace) notFound();

  const { convention, sessions, revisions } = workspace;
  const sessionSearch =
    typeof query.sessionSearch === "string" ? query.sessionSearch.trim() : "";
  const filteredSessions = sessionSearch
    ? sessions.filter((session) =>
        [session.title, session.room, session.description]
          .join(" ")
          .toLowerCase()
          .includes(sessionSearch.toLowerCase()),
      )
    : sessions;
  const sessionPageSize = 10;
  const sessionPageCount = Math.max(
    1,
    Math.ceil(filteredSessions.length / sessionPageSize),
  );
  const requestedSessionPage = Number(query.sessionsPage ?? 1);
  const sessionPage =
    Number.isInteger(requestedSessionPage) && requestedSessionPage > 0
      ? Math.min(requestedSessionPage, sessionPageCount)
      : 1;
  const sessionOffset = (sessionPage - 1) * sessionPageSize;
  const visibleSessions = filteredSessions.slice(
    sessionOffset,
    sessionOffset + sessionPageSize,
  );
  const sessionPageHref = (page: number) => {
    const search = new URLSearchParams();
    if (sessionSearch) search.set("sessionSearch", sessionSearch);
    search.set("sessionsPage", String(page));
    return `/conventions/${id}?${search.toString()}#schedule`;
  };
  const currentRevision = convention.publishedRevision ?? 0;
  const liveRevision = revisions.find(
    (revision) => revision.revision === currentRevision,
  );
  const currentSnapshot = buildPublicSnapshot({
    convention,
    sessions,
    revision: currentRevision,
  });
  const hasUnpublishedChanges =
    !liveRevision ||
    liveRevision.snapshotJson !== JSON.stringify(currentSnapshot);
  const parsedLiveSnapshot = liveRevision
    ? parseRevisionSnapshot(liveRevision.snapshotJson)
    : null;
  const changes = getSnapshotChanges(parsedLiveSnapshot, currentSnapshot);
  const publicationIssues = getPublicationIssues({
    convention: {
      name: convention.name,
      acronym: convention.acronym,
      slug: convention.slug,
      city: convention.city,
      region: convention.region,
      country: convention.country,
      startsOn: convention.startsOn,
      endsOn: convention.endsOn,
      timezone: convention.timezone,
      venue: convention.venue,
      officialUrl: convention.officialUrl,
      availability: convention.availability,
      scheduleStatus: convention.scheduleStatus,
      sourceVerifiedAt: convention.sourceVerifiedAt,
    },
    sessions,
    today: todayInTimezone(convention.timezone),
  });
  const errorKey = typeof query.error === "string" ? query.error : "";
  const published =
    typeof query.published === "string" ? query.published : null;
  const saved = typeof query.saved === "string" ? query.saved : null;
  const sourceCheckComplete =
    Boolean(convention.sourceVerifiedAt) &&
    !publicationIssues.some((issue) => issue.toLowerCase().includes("source"));
  const publishStepStatus = publicationIssues.length
    ? `${publicationIssues.length} ${publicationIssues.length === 1 ? "item" : "items"} to fix`
    : hasUnpublishedChanges
      ? "Ready to publish"
      : "No new changes";

  return (
    <>
      <PageHeading
        eyebrow={`Convention · ${convention.slug}`}
        title={convention.name}
        description={`${convention.city}, ${convention.region || convention.country} · ${formatDate(convention.startsOn)}–${formatDate(convention.endsOn)} · ${convention.timezone}`}
        action={<StatusPill status={convention.status} />}
      />
      {errorMessages[errorKey] ? (
        <Banner tone="error">{errorMessages[errorKey]}</Banner>
      ) : null}
      {published ? (
        <Banner tone="success">
          Revision v{published} was saved to the catalog. The public attendee
          API serves published revisions; native downloads and alerts are not
          connected yet.
        </Banner>
      ) : null}
      {typeof query.restored === "string" ? (
        <Banner tone="success">
          Revision v{query.restored} was restored as a new publication.
        </Banner>
      ) : null}
      {saved ? (
        <Banner tone="success">
          {saved === "session"
            ? "Schedule changes saved as a private draft."
            : "Convention details saved as a private draft."}{" "}
          Publish a new revision when it is ready for attendees.
        </Banner>
      ) : null}

      <nav
        aria-label="Convention sections"
        className="admin-section-nav sticky z-10 -mx-4 mb-5 grid grid-cols-3 gap-2 border-y border-slate-200 bg-[#f5f7fb]/95 px-4 py-2 backdrop-blur lg:static lg:mx-0 lg:mb-5 lg:border-0 lg:bg-transparent lg:px-0 lg:py-0"
      >
        <a
          href={sourceCheckComplete ? "#setup-details" : "#organizer-source"}
          className="flex min-h-14 min-w-0 flex-col justify-center rounded-xl border border-slate-200 bg-white px-2 py-2 shadow-sm outline-none transition hover:border-sky-300 focus-visible:ring-4 focus-visible:ring-sky-200 sm:px-3"
        >
          <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500 sm:tracking-[0.12em]">
            01 Details
          </span>
          <span
            className={`mt-0.5 text-[10px] font-semibold leading-4 ${sourceCheckComplete ? "text-emerald-700" : "text-amber-800"}`}
          >
            {sourceCheckComplete ? "Source checked" : "Verify source"}
          </span>
        </a>
        <a
          href="#schedule"
          className="flex min-h-14 min-w-0 flex-col justify-center rounded-xl border border-slate-200 bg-white px-2 py-2 shadow-sm outline-none transition hover:border-sky-300 focus-visible:ring-4 focus-visible:ring-sky-200 sm:px-3"
        >
          <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500 sm:tracking-[0.12em]">
            02 Schedule
          </span>
          <span className="mt-0.5 truncate text-[10px] font-semibold leading-4 text-slate-700">
            {sessions.length
              ? `${sessions.length} ${sessions.length === 1 ? "session" : "sessions"}`
              : "Add sessions"}
          </span>
        </a>
        <a
          href="#publish"
          className="flex min-h-14 min-w-0 flex-col justify-center rounded-xl border border-slate-200 bg-white px-2 py-2 shadow-sm outline-none transition hover:border-sky-300 focus-visible:ring-4 focus-visible:ring-sky-200 sm:px-3"
        >
          <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500 sm:tracking-[0.12em]">
            03 Publish
          </span>
          <span
            className={`mt-0.5 truncate text-[10px] font-semibold leading-4 ${publicationIssues.length ? "text-amber-800" : hasUnpublishedChanges ? "text-emerald-700" : "text-slate-600"}`}
          >
            {publishStepStatus}
          </span>
        </a>
      </nav>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="grid gap-5">
          <Surface id="setup-details" className="scroll-mt-36 overflow-hidden">
            <details
              open={
                !convention.sourceVerifiedAt ||
                Boolean(errorMessages[errorKey]) ||
                saved === "details"
              }
              className="group/details"
            >
              <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-4 border-b border-slate-100 px-5 py-4 outline-none focus-visible:ring-4 focus-visible:ring-sky-200 sm:px-7 [&::-webkit-details-marker]:hidden">
                <span className="min-w-0">
                  <span className="block font-display text-base font-bold text-[#091533]">
                    Convention details
                  </span>
                  <span className="mt-1 block text-xs leading-5 text-slate-500">
                    Changes here update your private draft. The attendee copy
                    remains on its published revision.
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-2 text-xs font-semibold text-slate-600">
                  {convention.sourceVerifiedAt ? "Edit" : "Set up"}
                  <Icon
                    name="chevron"
                    className="size-4 transition-transform group-open/details:rotate-90"
                  />
                </span>
              </summary>
              <form action={updateConvention}>
                <input type="hidden" name="id" value={convention.id} />
                <input
                  type="hidden"
                  name="updatedAt"
                  value={convention.updatedAt}
                />
                <div className="grid gap-7 p-5 sm:p-7">
                  <fieldset className="grid gap-x-5 gap-y-4 sm:grid-cols-2">
                    <legend className="mb-1 w-full border-b border-slate-100 pb-3 font-display text-sm font-semibold text-[#091533]">
                      1. Convention
                    </legend>
                    <Field
                      name="name"
                      label="Convention name"
                      defaultValue={convention.name}
                      required
                      maxLength={120}
                      className="sm:col-span-2"
                    />
                    <Field
                      name="acronym"
                      label="Short name"
                      defaultValue={convention.acronym}
                      maxLength={16}
                    />
                    <Field
                      name="slug"
                      label="Public URL key"
                      defaultValue={convention.slug}
                      required
                      maxLength={96}
                    />
                  </fieldset>

                  <fieldset className="grid gap-x-5 gap-y-4 sm:grid-cols-2">
                    <legend className="mb-1 w-full border-b border-slate-100 pb-3 font-display text-sm font-semibold text-[#091533]">
                      2. Dates and location
                    </legend>
                    <Field
                      name="startsOn"
                      label="Start date"
                      type="date"
                      defaultValue={convention.startsOn}
                      required
                    />
                    <Field
                      name="endsOn"
                      label="End date"
                      type="date"
                      defaultValue={convention.endsOn}
                      required
                    />
                    <Field
                      name="timezone"
                      label="IANA time zone"
                      defaultValue={convention.timezone}
                      required
                    />
                    <Field
                      name="venue"
                      label="Venue"
                      defaultValue={convention.venue}
                      maxLength={160}
                    />
                    <Field
                      name="city"
                      label="City"
                      defaultValue={convention.city}
                      required
                      maxLength={80}
                    />
                    <Field
                      name="region"
                      label="State / region"
                      defaultValue={convention.region}
                      maxLength={80}
                    />
                    <Field
                      name="country"
                      label="Country"
                      defaultValue={convention.country}
                      required
                      maxLength={80}
                      className="sm:col-span-2"
                    />
                  </fieldset>

                  <fieldset
                    id="organizer-source"
                    className="scroll-mt-36 grid gap-x-5 gap-y-4 sm:grid-cols-2"
                  >
                    <legend className="mb-1 w-full border-b border-slate-100 pb-3 font-display text-sm font-semibold text-[#091533]">
                      3. Organizer and program
                    </legend>
                    <Field
                      name="officialUrl"
                      label="Organizer website"
                      type="url"
                      defaultValue={convention.officialUrl}
                      required
                      className="sm:col-span-2"
                    />
                    <Field
                      name="sourceVerifiedAt"
                      label="Organizer source checked"
                      type="date"
                      defaultValue={convention.sourceVerifiedAt ?? ""}
                      hint="Required before publishing."
                      className="sm:col-span-2"
                    />
                    <SelectField
                      name="availability"
                      label="Registration availability"
                      defaultValue={convention.availability}
                    >
                      {availabilityOptions.map((value) => (
                        <option key={value} value={value}>
                          {availabilityLabels[value]}
                        </option>
                      ))}
                    </SelectField>
                    <SelectField
                      name="scheduleStatus"
                      label="Program schedule"
                      defaultValue={convention.scheduleStatus}
                    >
                      {scheduleStatusOptions.map((value) => (
                        <option key={value} value={value}>
                          {scheduleStatusLabels[value]}
                        </option>
                      ))}
                    </SelectField>
                    <Field
                      name="sourceVerifiedAt"
                      label="Organizer source checked"
                      type="date"
                      defaultValue={convention.sourceVerifiedAt ?? ""}
                      hint="Publishing requires a recorded check date. The URL and date are kept privately in each revision."
                      className="sm:col-span-2"
                    />
                  </fieldset>
                </div>
                <div className="flex justify-end border-t border-slate-100 bg-slate-50/60 px-5 py-4 sm:px-7">
                  <Button type="submit" variant="secondary">
                    Save details
                  </Button>
                </div>
              </form>
            </details>
          </Surface>

          <Surface id="schedule" className="scroll-mt-36 overflow-hidden">
            <div className="flex flex-col gap-2 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-7">
              <div>
                <h2 className="font-display text-base font-bold text-[#091533]">
                  Schedule
                </h2>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Times are local to {convention.timezone}. Cancellations reach
                  attendees on the next publish.
                </p>
              </div>
              <span className="w-fit self-start rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                {sessions.length}{" "}
                {sessions.length === 1 ? "session" : "sessions"}
              </span>
            </div>
            {sessions.length ? (
              <form
                action={`/conventions/${id}#schedule`}
                method="get"
                className="grid gap-3 border-b border-slate-100 bg-slate-50/60 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end sm:px-7"
              >
                <label htmlFor="schedule-search" className="block">
                  <span className="mb-1.5 block text-sm font-semibold text-slate-800">
                    Find a session
                  </span>
                  <input
                    id="schedule-search"
                    type="search"
                    name="sessionSearch"
                    defaultValue={sessionSearch}
                    placeholder="Search titles, rooms and descriptions"
                    className="min-h-12 w-full rounded-xl border border-slate-300 bg-white px-3.5 text-base text-slate-900 outline-none focus:border-sky-500 focus:ring-4 focus:ring-sky-100"
                  />
                  <input type="hidden" name="sessionsPage" value="1" />
                </label>
                <Button type="submit" variant="secondary">
                  Search schedule
                </Button>
              </form>
            ) : null}
            {sessions.length === 0 ? (
              <div className="border-b border-slate-100 px-5 py-5 sm:px-7">
                <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-600">
                  No schedule entries yet. You can publish the convention
                  listing now and add the program as the organizer releases it.
                </p>
              </div>
            ) : filteredSessions.length === 0 ? (
              <div className="border-b border-slate-100 px-5 py-5 sm:px-7">
                <p className="text-sm leading-6 text-slate-600">
                  No sessions match “{sessionSearch}”. Clear the search to see
                  the full schedule.
                </p>
                <a
                  href={`/conventions/${id}#schedule`}
                  className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-sky-800 underline underline-offset-4"
                >
                  Clear session search
                </a>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {visibleSessions.map((event) => (
                  <details
                    key={event.id}
                    name={`schedule-${convention.id}`}
                    className="group px-4 py-3 sm:px-7 sm:py-4"
                  >
                    <summary className="flex min-h-12 cursor-pointer list-none flex-wrap items-center justify-between gap-3 rounded-xl py-2 outline-none focus-visible:ring-4 focus-visible:ring-sky-200 [&::-webkit-details-marker]:hidden">
                      <span className="grid min-w-0 flex-1 gap-1">
                        <span className="truncate text-sm font-semibold text-[#091533]">
                          {event.title}
                        </span>
                        <span className="text-xs leading-5 text-slate-600">
                          {dateTime(event.startsAt)}–{event.endsAt.slice(11)}
                          <span className="mx-1.5">·</span>
                          {event.room || "Room to be assigned"}
                        </span>
                      </span>
                      <span className="flex shrink-0 items-center gap-2">
                        <StatusPill status={event.status} />
                        <span className="text-xs font-semibold text-sky-800">
                          Edit
                        </span>
                        <Icon
                          name="chevron"
                          className="size-4 text-slate-500 transition-transform group-open:rotate-90"
                        />
                      </span>
                    </summary>
                    <form
                      action={updateScheduleEvent}
                      className="grid gap-3 pb-2 pt-4 sm:pt-5"
                    >
                      <input
                        type="hidden"
                        name="conventionId"
                        value={convention.id}
                      />
                      <input type="hidden" name="eventId" value={event.id} />
                      <input
                        type="hidden"
                        name="eventUpdatedAt"
                        value={event.updatedAt}
                      />
                      <input
                        type="hidden"
                        name="conventionUpdatedAt"
                        value={convention.updatedAt}
                      />
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
                          {dateTime(event.startsAt)}–{event.endsAt.slice(11)}{" "}
                          <span className="font-normal normal-case">
                            {convention.timezone}
                          </span>
                        </p>
                        <StatusPill status={event.status} />
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <Field
                          name="title"
                          label="Session title"
                          defaultValue={event.title}
                          required
                          maxLength={140}
                        />
                        <Field
                          name="room"
                          label="Room"
                          defaultValue={event.room}
                          maxLength={100}
                        />
                        <Field
                          name="startsAt"
                          label="Starts (local time)"
                          type="datetime-local"
                          defaultValue={event.startsAt}
                          required
                        />
                        <Field
                          name="endsAt"
                          label="Ends (local time)"
                          type="datetime-local"
                          defaultValue={event.endsAt}
                          required
                        />
                      </div>
                      <TextAreaField
                        name="description"
                        label="Description"
                        defaultValue={event.description}
                        maxLength={1000}
                        rows={2}
                      />
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <SelectField
                          name="status"
                          label="Session status"
                          defaultValue={event.status}
                          className="sm:max-w-56"
                        >
                          <option value="scheduled">Scheduled</option>
                          <option value="cancelled">Cancelled</option>
                        </SelectField>
                        <Button type="submit" variant="secondary">
                          Save session
                        </Button>
                      </div>
                    </form>
                  </details>
                ))}
              </div>
            )}
            {filteredSessions.length > sessionPageSize ? (
              <nav
                aria-label="Schedule pages"
                className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-3 sm:px-7"
              >
                <p className="text-xs text-slate-500">
                  Showing {sessionOffset + 1}–
                  {Math.min(
                    sessionOffset + sessionPageSize,
                    filteredSessions.length,
                  )}{" "}
                  of {filteredSessions.length} matching sessions
                </p>
                <div className="flex gap-2">
                  {sessionPage > 1 ? (
                    <Button
                      href={sessionPageHref(sessionPage - 1)}
                      variant="secondary"
                    >
                      Previous
                    </Button>
                  ) : null}
                  {sessionPage < sessionPageCount ? (
                    <Button
                      href={sessionPageHref(sessionPage + 1)}
                      variant="secondary"
                    >
                      Next
                    </Button>
                  ) : null}
                </div>
              </nav>
            ) : filteredSessions.length > 0 ? (
              <p className="border-t border-slate-100 px-5 py-3 text-xs text-slate-500 sm:px-7">
                Showing {sessionOffset + 1}–{filteredSessions.length} of{" "}
                {filteredSessions.length} matching sessions
              </p>
            ) : null}
            <form
              action={createScheduleEvent}
              className="grid gap-4 bg-[#f8fafc] p-5 sm:p-7"
            >
              <input type="hidden" name="conventionId" value={convention.id} />
              <input
                type="hidden"
                name="updatedAt"
                value={convention.updatedAt}
              />
              <div>
                <h3 className="text-sm font-bold text-[#091533]">
                  Add a session
                </h3>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Use the published program’s wording and local start/end times.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field
                  name="title"
                  label="Session title"
                  placeholder="Opening ceremony"
                  required
                  maxLength={140}
                />
                <Field
                  name="room"
                  label="Room"
                  placeholder="Main stage"
                  maxLength={100}
                />
                <Field
                  name="startsAt"
                  label="Starts (local time)"
                  type="datetime-local"
                  required
                />
                <Field
                  name="endsAt"
                  label="Ends (local time)"
                  type="datetime-local"
                  required
                />
              </div>
              <TextAreaField
                name="description"
                label="Description"
                placeholder="What attendees need to know"
                maxLength={1000}
                rows={2}
              />
              <div className="flex justify-end">
                <Button type="submit" variant="secondary">
                  <Icon name="plus" className="size-4" /> Add session
                </Button>
              </div>
            </form>
          </Surface>
        </div>

        <aside className="grid gap-5">
          <Surface id="publish" className="scroll-mt-36 overflow-hidden">
            <div className="border-b border-slate-100 px-5 py-4">
              <h2 className="font-display text-base font-bold text-[#091533]">
                Publication status
              </h2>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                Published snapshots are immutable. A correction creates the next
                revision.
              </p>
            </div>
            <div className="p-5">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-slate-600">
                  Current published revision
                </span>
                {currentRevision ? (
                  <span className="font-mono text-lg font-bold tabular-nums text-[#091533]">
                    v{currentRevision}
                  </span>
                ) : (
                  <StatusPill status="draft" />
                )}
              </div>
              <div className="mt-3 flex items-center justify-between gap-3 text-xs text-slate-500">
                <span>Draft state</span>
                <span
                  className={
                    hasUnpublishedChanges
                      ? "font-semibold text-amber-800"
                      : "font-semibold text-emerald-700"
                  }
                >
                  {hasUnpublishedChanges
                    ? "Changes to publish"
                    : "Matches live copy"}
                </span>
              </div>
              <div className="mt-4 rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-600">
                {sessions.filter((event) => event.status === "cancelled")
                  .length > 0
                  ? `${sessions.filter((event) => event.status === "cancelled").length} cancelled session(s) will be included in the next revision.`
                  : "Draft edits do not change published snapshots. Phone downloads and alerts are not connected yet."}
              </div>
              <div className="mt-4 rounded-xl border border-slate-200 p-3">
                <h3 className="text-xs font-bold uppercase tracking-[0.1em] text-slate-500">
                  Changes in this revision
                </h3>
                <ul className="mt-2 grid gap-1.5 text-xs leading-5 text-slate-700">
                  {changes.map((change) => (
                    <li key={change}>{change}</li>
                  ))}
                </ul>
              </div>
              {publicationIssues.length ? (
                <div className="mt-3 rounded-xl border border-amber-300 bg-amber-50 p-3">
                  <h3 className="text-xs font-bold text-amber-950">
                    Publication checklist
                  </h3>
                  <ul className="mt-1 grid gap-1 text-xs leading-5 text-amber-900">
                    {publicationIssues.map((issue) => (
                      <li key={issue}>{issue}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <form action={publishConvention} className="mt-4 grid gap-3">
                <input type="hidden" name="id" value={convention.id} />
                <input
                  type="hidden"
                  name="updatedAt"
                  value={convention.updatedAt}
                />
                <input
                  type="hidden"
                  name="publishedRevision"
                  value={currentRevision}
                />
                <Field
                  name="summary"
                  label="Change summary"
                  placeholder="Corrected room and added two sessions"
                  required
                  minLength={5}
                  maxLength={200}
                  hint="Visible to your admin team in revision history."
                />
                <Button
                  type="submit"
                  disabled={
                    !hasUnpublishedChanges || publicationIssues.length > 0
                  }
                >
                  Publish revision {currentRevision + 1}
                </Button>
              </form>
            </div>
          </Surface>

          <Surface className="overflow-hidden">
            <div className="border-b border-slate-100 px-5 py-4">
              <h2 className="font-display text-base font-bold text-[#091533]">
                Revision history
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                {revisions.length} publication(s)
              </p>
            </div>
            {revisions.length === 0 ? (
              <p className="px-5 py-5 text-sm leading-6 text-slate-600">
                No revision has been published yet. Your first publish creates
                v1.
              </p>
            ) : (
              <ol className="divide-y divide-slate-100">
                {revisions.map((revision) => (
                  <li key={revision.id} className="px-5 py-4">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-mono text-sm font-bold tabular-nums text-[#091533]">
                        v{revision.revision}
                      </span>
                      {revision.revision === convention.publishedRevision ? (
                        <span className="text-[11px] font-bold text-emerald-700">
                          LIVE
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-2 text-sm font-semibold text-slate-800">
                      {revision.summary}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {revision.actorEmail} <span className="mx-1">·</span>{" "}
                      {formatMoment(revision.createdAt)}
                    </p>
                    {revision.sourceVerifiedAt ? (
                      <p className="mt-1 text-xs text-slate-500">
                        Organizer source checked {revision.sourceVerifiedAt}
                      </p>
                    ) : null}
                    {revision.sourceUrl ? (
                      <a
                        href={revision.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-1 block break-all text-xs font-medium text-sky-800 hover:underline"
                      >
                        Open source used for this revision
                      </a>
                    ) : null}
                    {revision.revision !== convention.publishedRevision ? (
                      <form action={restoreRevision} className="mt-3">
                        <input type="hidden" name="id" value={convention.id} />
                        <input
                          type="hidden"
                          name="revision"
                          value={revision.revision}
                        />
                        <input
                          type="hidden"
                          name="updatedAt"
                          value={convention.updatedAt}
                        />
                        <input
                          type="hidden"
                          name="publishedRevision"
                          value={currentRevision}
                        />
                        <Button type="submit" variant="secondary">
                          Restore as new revision
                        </Button>
                      </form>
                    ) : null}
                  </li>
                ))}
              </ol>
            )}
          </Surface>

          <Surface className="p-5">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
              Organizer source
            </p>
            <p className="mt-2 break-all text-sm font-semibold text-slate-800">
              {convention.officialUrl}
            </p>
            <a
              className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-sky-800 hover:underline"
              href={convention.officialUrl}
              target="_blank"
              rel="noreferrer"
            >
              Open organizer website <Icon name="arrow" className="size-4" />
            </a>
          </Surface>
        </aside>
      </div>
    </>
  );
}
