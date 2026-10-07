import { Icon } from "../../../components/icons";
import {
  Banner,
  Button,
  EmptyState,
  formatDate,
  PageHeading,
  SelectField,
  StatusPill,
  Surface,
} from "../../../components/ui";
import { adminErrorMessage } from "../../../lib/admin-error-message";
import { requireAdmin } from "../../../lib/auth";
import { getConventions } from "../../../lib/queries";

export const metadata = { title: "Conventions" };

export default async function ConventionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();
  const params = await searchParams;
  const query = typeof params.q === "string" ? params.q : "";
  const requestedStatus =
    typeof params.status === "string" ? params.status : "all";
  const status =
    requestedStatus === "draft" ||
    requestedStatus === "published" ||
    requestedStatus === "archived"
      ? requestedStatus
      : "all";
  const items = await getConventions({ query, status });
  return (
    <>
      {typeof params.error === "string" && adminErrorMessage(params.error) ? (
        <Banner tone="error">{adminErrorMessage(params.error)}</Banner>
      ) : null}
      <PageHeading
        eyebrow="Catalog"
        title="Conventions"
        description="Keep the directory verified. Drafts remain private until you publish a schedule revision."
        action={
          <Button href="/conventions/new">
            <Icon name="plus" className="size-4" /> Add convention
          </Button>
        }
      />
      <Surface className="mb-4 p-4 sm:p-5">
        <form
          action="/conventions"
          method="get"
          className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_220px_auto] sm:items-end"
        >
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-slate-800">
              Search conventions
            </span>
            <input
              type="search"
              name="q"
              defaultValue={query}
              placeholder="Name, location or short code"
              className="min-h-12 w-full rounded-xl border border-slate-300 bg-white px-3.5 text-base text-slate-900 outline-none focus:border-sky-500 focus:ring-4 focus:ring-sky-100"
            />
          </label>
          <SelectField name="status" label="Status" defaultValue={status}>
            <option value="all">All statuses</option>
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="archived">Archived</option>
          </SelectField>
          <Button type="submit">Filter</Button>
        </form>
      </Surface>
      <Surface className="overflow-hidden">
        {items.length === 0 ? (
          <EmptyState
            title={
              query || status !== "all"
                ? "No matching conventions"
                : "Your catalog is empty"
            }
            description={
              query || status !== "all"
                ? "Try another search or status, or clear the filters."
                : "Create the first convention entry, then add its sessions and publish a reviewed revision."
            }
            action={
              <Button
                href={
                  query || status !== "all"
                    ? "/conventions"
                    : "/conventions/new"
                }
              >
                {query || status !== "all" ? null : (
                  <Icon name="plus" className="size-4" />
                )}
                {query || status !== "all"
                  ? "Clear filters"
                  : "Create convention"}
              </Button>
            }
          />
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[720px] border-collapse text-left">
                <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">
                  <tr>
                    <th className="px-5 py-3.5">Convention</th>
                    <th className="px-5 py-3.5">Dates</th>
                    <th className="px-5 py-3.5">Location</th>
                    <th className="px-5 py-3.5">Status</th>
                    <th className="px-5 py-3.5">Published revision</th>
                    <th className="px-4 py-3.5">
                      <span className="sr-only">Open</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((item) => (
                    <tr key={item.id} className="group hover:bg-slate-50/70">
                      <td className="px-5 py-4">
                        <a
                          href={`/conventions/${item.id}`}
                          className="font-semibold text-[#091533] group-hover:text-sky-800"
                        >
                          {item.name}
                        </a>
                        <p className="mt-1 text-xs text-slate-500">
                          {item.acronym || item.slug}
                        </p>
                      </td>
                      <td className="px-5 py-4 text-sm text-slate-700">
                        {formatDate(item.startsOn)}
                        <span className="mx-1.5 text-slate-400">—</span>
                        {formatDate(item.endsOn)}
                      </td>
                      <td className="px-5 py-4 text-sm text-slate-700">
                        {[item.city, item.region, item.country]
                          .filter(Boolean)
                          .join(", ")}
                      </td>
                      <td className="px-5 py-4">
                        <StatusPill status={item.status} />
                      </td>
                      <td className="px-5 py-4 font-mono text-sm tabular-nums text-slate-700">
                        {item.publishedRevision
                          ? `v${item.publishedRevision}`
                          : "—"}
                      </td>
                      <td className="px-4 py-4">
                        <a
                          href={`/conventions/${item.id}`}
                          aria-label={`Open ${item.name}`}
                          className="grid size-9 place-items-center rounded-lg text-slate-500 hover:bg-white hover:text-sky-800"
                        >
                          <Icon name="chevron" className="size-4" />
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="divide-y divide-slate-100 md:hidden">
              {items.map((item) => (
                <li key={item.id}>
                  <a
                    href={`/conventions/${item.id}`}
                    className="block px-4 py-4 transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-sky-700"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span className="min-w-0 break-words font-semibold text-[#091533]">
                        {item.name}
                      </span>
                      <StatusPill status={item.status} />
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      {item.acronym || item.slug}
                    </p>
                    <p className="mt-3 text-sm text-slate-700">
                      {formatDate(item.startsOn)}–{formatDate(item.endsOn)}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {[item.city, item.region, item.country]
                        .filter(Boolean)
                        .join(", ")}
                    </p>
                    <p className="mt-2 text-xs text-slate-500">
                      {item.publishedRevision
                        ? `Live revision v${item.publishedRevision}`
                        : "Not published"}
                    </p>
                  </a>
                </li>
              ))}
            </ul>
          </>
        )}
      </Surface>
      <p className="mt-4 text-xs leading-5 text-slate-500">
        Convention records are manually curated in this first release. Feed
        import and automatic conflict detection are not enabled yet.
      </p>
    </>
  );
}
