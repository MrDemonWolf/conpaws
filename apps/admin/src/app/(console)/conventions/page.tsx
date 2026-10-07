import { Input } from "@conpaws/ui/components/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@conpaws/ui/components/table";
import { Icon } from "../../../components/icons";
import {
  Button,
  EmptyState,
  formatDate,
  PageHeading,
  SelectField,
  StatusPill,
  Surface,
} from "../../../components/ui";
import { requireAdmin } from "../../../lib/auth";
import { getConventions } from "../../../lib/queries";

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
          <label htmlFor="convention-search" className="block">
            <span className="mb-1.5 block text-sm font-semibold text-slate-800">
              Search conventions
            </span>
            <Input
              type="search"
              id="convention-search"
              name="q"
              defaultValue={query}
              placeholder="Name, location or short code"
            />
          </label>
          <SelectField name="status" label="Status" defaultValue={status}>
            <option value="all">All statuses</option>
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="archived">Archived</option>
          </SelectField>
          <Button type="submit" variant="secondary">
            Filter
          </Button>
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
            <div className="hidden md:block">
              <Table className="min-w-[720px]">
                <TableHeader>
                  <tr>
                    <TableHead
                      scope="col"
                      className="uppercase tracking-[0.1em]"
                    >
                      Convention
                    </TableHead>
                    <TableHead
                      scope="col"
                      className="uppercase tracking-[0.1em]"
                    >
                      Dates
                    </TableHead>
                    <TableHead
                      scope="col"
                      className="uppercase tracking-[0.1em]"
                    >
                      Location
                    </TableHead>
                    <TableHead
                      scope="col"
                      className="uppercase tracking-[0.1em]"
                    >
                      Status
                    </TableHead>
                    <TableHead
                      scope="col"
                      className="uppercase tracking-[0.1em]"
                    >
                      Published revision
                    </TableHead>
                    <TableHead scope="col" className="w-12 px-4">
                      <span className="sr-only">Open</span>
                    </TableHead>
                  </tr>
                </TableHeader>
                <TableBody>
                  {items.map((item) => (
                    <TableRow
                      key={item.id}
                      className="group hover:bg-slate-50/70"
                    >
                      <TableCell>
                        <a
                          href={`/conventions/${item.id}`}
                          className="font-semibold text-[#091533] group-hover:text-sky-800"
                        >
                          {item.name}
                        </a>
                        <p className="mt-1 text-xs text-slate-500">
                          {item.acronym || item.slug}
                        </p>
                      </TableCell>
                      <TableCell className="text-sm text-slate-700">
                        {formatDate(item.startsOn)}
                        <span className="mx-1.5 text-slate-400">—</span>
                        {formatDate(item.endsOn)}
                      </TableCell>
                      <TableCell className="text-sm text-slate-700">
                        {[item.city, item.region, item.country]
                          .filter(Boolean)
                          .join(", ")}
                      </TableCell>
                      <TableCell>
                        <StatusPill status={item.status} />
                      </TableCell>
                      <TableCell className="font-mono text-sm tabular-nums text-slate-700">
                        {item.publishedRevision
                          ? `v${item.publishedRevision}`
                          : "—"}
                      </TableCell>
                      <TableCell className="px-4">
                        <a
                          href={`/conventions/${item.id}`}
                          aria-label={`Open ${item.name}`}
                          className="grid size-11 place-items-center rounded-md text-slate-500 hover:bg-white hover:text-sky-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700"
                        >
                          <Icon name="chevron" className="size-4" />
                        </a>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
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
