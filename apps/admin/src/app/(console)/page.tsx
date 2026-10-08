import { Icon } from "../../components/icons";
import {
  Button,
  EmptyState,
  formatDate,
  formatMoment,
  PageHeading,
  StatCard,
  StatusPill,
  Surface,
} from "../../components/ui";
import { requireAdmin } from "../../lib/auth";
import { getDashboardData } from "../../lib/queries";

export const metadata = { title: "Overview" };

export default async function OverviewPage() {
  await requireAdmin();
  const data = await getDashboardData();
  const hasConventions = data.published + data.drafts > 0;
  const currentDraft = data.draftItems[0];

  return (
    <>
      <PageHeading
        eyebrow="Workspace"
        title="Overview"
        description="See what is published, move drafts toward review, and set up the next convention."
        action={
          hasConventions ? (
            currentDraft ? (
              <Button href={`/conventions/${currentDraft.id}`}>
                Continue draft <Icon name="chevron" className="size-4" />
              </Button>
            ) : (
              <Button href="/conventions/new">
                <Icon name="plus" className="size-4" /> Add convention
              </Button>
            )
          ) : undefined
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard
          label="Published"
          value={data.published}
          detail="Live editions"
          accent="green"
          icon={<Icon name="check" className="size-[18px]" />}
        />
        <StatCard
          label="Drafts"
          value={data.drafts}
          detail="Need review"
          accent="amber"
          icon={<Icon name="activity" className="size-[18px]" />}
        />
        <StatCard
          label="Sessions"
          value={data.sessions}
          detail="Across the catalog"
          accent="sky"
          icon={<Icon name="calendar" className="size-[18px]" />}
        />
        <StatCard
          label="Admins"
          value={data.members}
          detail="Owner and editors"
          accent="navy"
          icon={<Icon name="users" className="size-[18px]" />}
        />
      </div>

      {!hasConventions ? (
        <Surface className="mt-5 overflow-hidden">
          <div className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[1.3fr_0.7fr] lg:p-10">
            <div className="max-w-xl">
              <span className="inline-flex items-center gap-2 rounded-full bg-sky-50 px-3 py-1.5 text-xs font-bold text-sky-800">
                <span className="size-1.5 rounded-full bg-sky-500" /> A simple
                path to launch
              </span>
              <h2 className="mt-5 font-display text-2xl font-bold tracking-tight text-[#091533] sm:text-[28px]">
                Set up your first convention.
              </h2>
              <p className="mt-3 text-[15px] leading-7 text-slate-600">
                Start with the details you have. Add the schedule when it is
                ready, then publish a reviewed edition for attendees.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Button href="/conventions/new">
                  <Icon name="plus" className="size-4" /> Start setup
                </Button>
                <a
                  href="/conventions"
                  className="inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                >
                  View catalog <Icon name="chevron" className="size-4" />
                </a>
              </div>
            </div>
            <div className="rounded-2xl bg-[#f5f8fc] p-5 sm:p-6">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                Publishing path
              </p>
              <ol className="mt-5 grid gap-4">
                {[
                  [
                    "01",
                    "Create the listing",
                    "Add the event dates, location and official website.",
                  ],
                  [
                    "02",
                    "Add the schedule",
                    "Enter sessions as the organizer releases them.",
                  ],
                  [
                    "03",
                    "Review and publish",
                    "Check the details, then make the edition available.",
                  ],
                ].map(([number, title, detail]) => (
                  <li key={number} className="flex gap-3">
                    <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-white font-mono text-xs font-bold text-sky-900 ring-1 ring-slate-200">
                      {number}
                    </span>
                    <span>
                      <span className="block text-sm font-bold text-[#091533]">
                        {title}
                      </span>
                      <span className="mt-1 block text-xs leading-5 text-slate-600">
                        {detail}
                      </span>
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </Surface>
      ) : (
        <div className="mt-5 grid gap-5 xl:grid-cols-[1.35fr_0.65fr]">
          <Surface className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 sm:px-6">
              <div>
                <h2 className="font-display text-base font-bold text-[#091533]">
                  {data.upcoming.length === 0 && data.draftItems.length > 0
                    ? "Drafts to finish"
                    : "Upcoming conventions"}
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  {data.upcoming.length === 0 && data.draftItems.length > 0
                    ? "Finish the details and review before publishing."
                    : "Published catalog records, ordered by start date."}
                </p>
              </div>
              <a
                href="/conventions"
                className="shrink-0 whitespace-nowrap text-sm font-semibold text-sky-900 hover:underline"
              >
                View all
              </a>
            </div>
            {data.upcoming.length === 0 ? (
              data.draftItems.length > 0 ? (
                <ul className="divide-y divide-slate-100">
                  {data.draftItems.map((convention) => (
                    <li key={convention.id}>
                      <a
                        href={`/conventions/${convention.id}`}
                        className="flex items-center justify-between gap-3 px-5 py-4 transition hover:bg-slate-50 sm:px-6"
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold text-[#091533]">
                            {convention.name}
                          </span>
                          <span className="mt-1 block text-xs leading-5 text-slate-500">
                            {formatDate(convention.startsOn)}–
                            {formatDate(convention.endsOn)}
                            {convention.city ? ` · ${convention.city}` : ""}
                          </span>
                        </span>
                        <span className="flex shrink-0 items-center gap-2">
                          <StatusPill status={convention.status} />
                          <Icon
                            name="chevron"
                            className="size-4 text-slate-400"
                          />
                        </span>
                      </a>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState
                  title="No published editions yet"
                  description="Add an organizer-verified convention listing, then create its first schedule."
                  action={
                    <Button href="/conventions/new">Set up a convention</Button>
                  }
                />
              )
            ) : (
              <ul className="divide-y divide-slate-100">
                {data.upcoming.map((convention) => (
                  <li key={convention.id}>
                    <a
                      href={`/conventions/${convention.id}`}
                      className="flex flex-col gap-3 px-5 py-4 transition hover:bg-slate-50 sm:flex-row sm:items-center sm:justify-between sm:px-6"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-bold text-[#091533]">
                          {convention.name}
                        </span>
                        <span className="mt-1 block text-xs text-slate-500">
                          {convention.city},{" "}
                          {convention.region || convention.country}{" "}
                          <span className="mx-1">·</span>{" "}
                          {formatDate(convention.startsOn)}–
                          {formatDate(convention.endsOn)}
                        </span>
                      </span>
                      <span className="flex items-center gap-2 self-start sm:self-auto">
                        <StatusPill status={convention.status} />
                        <Icon
                          name="chevron"
                          className="size-4 text-slate-400"
                        />
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </Surface>

          <Surface className="overflow-hidden">
            <div className="border-b border-slate-100 px-5 py-4">
              <h2 className="font-display text-base font-bold text-[#091533]">
                Recent activity
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Changes made by your admin team
              </p>
            </div>
            {data.recent.length === 0 ? (
              <EmptyState
                title="Activity will show here"
                description="Convention edits and publications are recorded for accountability."
              />
            ) : (
              <ul className="divide-y divide-slate-100">
                {data.recent.slice(0, 5).map((entry) => (
                  <li key={entry.id} className="px-5 py-3.5">
                    <p className="text-sm font-semibold text-slate-800">
                      {entry.summary}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {entry.actorEmail} <span className="mx-1">·</span>{" "}
                      {formatMoment(entry.createdAt)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
            <a
              href="/activity"
              className="block border-t border-slate-100 px-5 py-3.5 text-sm font-semibold text-sky-800 hover:bg-slate-50"
            >
              View activity history
            </a>
          </Surface>
        </div>
      )}
    </>
  );
}
