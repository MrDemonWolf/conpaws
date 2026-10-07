import {
  Banner,
  Button,
  Field,
  PageHeading,
  SelectField,
  Surface,
} from "../../../../components/ui";
import {
  availabilityLabels,
  availabilityOptions,
  scheduleStatusLabels,
  scheduleStatusOptions,
} from "../../../../lib/catalog";
import { createConvention } from "../../actions";

export const metadata = { title: "Add convention" };

export default async function NewConventionPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const error = params.error;
  const field = typeof params.field === "string" ? params.field : "";
  const fieldMessage =
    typeof params.message === "string" ? params.message : "Check this value.";
  const fieldError = (name: string) =>
    field === name ? fieldMessage : undefined;
  return (
    <>
      <PageHeading
        eyebrow="Catalog setup"
        title="Add a convention"
        description="Start with organizer-verified details. Add individual sessions next; nothing is public until you publish."
      />
      {error === "invalid" ? (
        <Banner tone="error">
          Some details are missing or invalid. Check the highlighted browser
          fields and try again.
        </Banner>
      ) : null}
      {error === "slug" ? (
        <Banner tone="error">
          That URL slug is already in use. Choose a different short name for
          this convention.
        </Banner>
      ) : null}
      <form action={createConvention}>
        <Surface className="overflow-hidden">
          <div className="border-b border-slate-100 px-5 py-4 sm:px-7">
            <h2 className="font-display text-base font-bold text-[#091533]">
              Convention details
            </h2>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              Dates use the convention’s local time zone. Verify this
              information against the organizer’s own website.
            </p>
          </div>
          <div className="grid gap-x-5 gap-y-5 p-5 sm:grid-cols-2 sm:p-7">
            <Field
              name="name"
              label="Convention name"
              error={fieldError("name")}
              placeholder="Example: Midwest FurFest"
              required
              minLength={2}
              maxLength={120}
              className="sm:col-span-2"
            />
            <Field
              name="acronym"
              label="Short name"
              error={fieldError("acronym")}
              placeholder="MFF"
              maxLength={16}
            />
            <Field
              name="slug"
              label="Public URL key"
              error={
                fieldError("slug") ??
                (error === "slug"
                  ? "That URL slug is already in use."
                  : undefined)
              }
              placeholder="midwest-furfest"
              hint="Lowercase letters, numbers and hyphens. Used by the app API."
              required
              minLength={2}
              maxLength={96}
              pattern="[a-z0-9]+(-[a-z0-9]+)*"
            />
            <Field
              name="city"
              label="City"
              error={fieldError("city")}
              placeholder="Rosemont"
              required
              minLength={1}
              maxLength={80}
            />
            <Field
              name="region"
              label="State / region"
              error={fieldError("region")}
              placeholder="Illinois"
              maxLength={80}
            />
            <Field
              name="country"
              label="Country"
              error={fieldError("country")}
              placeholder="United States"
              required
              minLength={2}
              maxLength={80}
            />
            <Field
              name="timezone"
              label="IANA time zone"
              error={fieldError("timezone")}
              placeholder="America/Chicago"
              defaultValue="America/Chicago"
              hint="Use an IANA zone such as America/Chicago or Europe/London."
              required
            />
            <Field
              name="startsOn"
              label="Start date"
              type="date"
              required
              error={fieldError("startsOn")}
            />
            <Field
              name="endsOn"
              label="End date"
              type="date"
              required
              error={fieldError("endsOn")}
            />
            <Field
              name="venue"
              label="Venue"
              error={fieldError("venue")}
              placeholder="Donald E. Stephens Convention Center"
              maxLength={160}
              className="sm:col-span-2"
            />
            <Field
              name="officialUrl"
              label="Official organizer website"
              error={fieldError("officialUrl")}
              type="url"
              placeholder="https://example.org"
              hint="Only the HTTPS URL is accepted; it is kept in the private admin record."
              required
              pattern="https://.+"
              className="sm:col-span-2"
            />
            <SelectField
              name="availability"
              label="Registration availability"
              defaultValue="unknown"
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
              defaultValue="not-released"
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
              error={fieldError("sourceVerifiedAt")}
              type="date"
              hint="Required before publishing. This date and URL are retained in private revision history."
              className="sm:col-span-2"
            />
          </div>
          <div className="flex flex-col-reverse gap-3 border-t border-slate-100 bg-slate-50/60 px-5 py-4 sm:flex-row sm:justify-end sm:px-7">
            <Button href="/conventions" variant="secondary">
              Cancel
            </Button>
            <Button type="submit">Save as private draft</Button>
          </div>
        </Surface>
      </form>
    </>
  );
}
