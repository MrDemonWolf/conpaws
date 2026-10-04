import {
  formatMoment,
  PageHeading,
  StatusPill,
  Surface,
} from "../../../components/ui";
import { requireAdmin } from "../../../lib/auth";
import { getRecentActivity } from "../../../lib/queries";

export default async function ActivityPage() {
  await requireAdmin();
  const entries = await getRecentActivity();
  return (
    <>
      <PageHeading
        eyebrow="Accountability"
        title="Activity history"
        description="A durable record of catalog edits, publications and admin role changes."
      />
      <Surface className="overflow-hidden">
        {entries.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <h2 className="font-display text-lg font-bold text-[#091533]">
              No activity recorded yet
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Changes made in the workspace will appear here.
            </p>
          </div>
        ) : (
          <ol className="divide-y divide-slate-100">
            {entries.map((entry) => (
              <li
                key={entry.id}
                className="grid gap-2 px-5 py-4 sm:grid-cols-[minmax(0,1fr)_190px] sm:items-center sm:px-7"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[#091533]">
                    {entry.summary}
                  </p>
                  <p className="mt-1 break-all text-xs text-slate-500">
                    {entry.actorEmail} <span className="mx-1">·</span>{" "}
                    {entry.action}
                  </p>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-600 sm:justify-end">
                  <StatusPill
                    status={
                      entry.resourceType === "admin_member"
                        ? "owner"
                        : "published"
                    }
                  />
                  <time dateTime={new Date(entry.createdAt).toISOString()}>
                    {formatMoment(entry.createdAt)}
                  </time>
                </div>
              </li>
            ))}
          </ol>
        )}
      </Surface>
    </>
  );
}
