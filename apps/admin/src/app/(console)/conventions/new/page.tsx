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
          <div className="grid gap-7 p-5 sm:p-7">
            <fieldset className="grid gap-x-5 gap-y-4 sm:grid-cols-2">
              <legend className="mb-1 w-full border-b border-slate-100 pb-3 font-display text-sm font-semibold text-[#091533]">
                1. Convention
              </legend>
              <p className="col-span-full -mt-2 text-xs leading-5 text-slate-500">
                Start with the name attendees will recognize and a short app
                URL.
              </p>
              <Field
                name="name"
                error={fieldError("name")}
                minLength={2}
                label="Convention name"
                placeholder="Example: Midwest FurFest"
                required
                maxLength={120}
                className="sm:col-span-2"
              />
              <Field
                name="acronym"
                error={fieldError("acronym")}
                label="Short name"
                placeholder="MFF"
                maxLength={16}
              />
              <Field
                name="slug"
                error={
                  fieldError("slug") ??
                  (error === "slug"
                    ? "That URL slug is already in use."
                    : undefined)
                }
                minLength={2}
                pattern="[a-z0-9]+(-[a-z0-9]+)*"
                label="Public URL key"
                placeholder="midwest-furfest"
                hint="Lowercase letters, numbers and hyphens."
                required
                maxLength={96}
              />
            </fieldset>

            <fieldset className="grid gap-x-5 gap-y-4 sm:grid-cols-2">
              <legend className="mb-1 w-full border-b border-slate-100 pb-3 font-display text-sm font-semibold text-[#091533]">
                2. Dates and location
              </legend>
              <p className="col-span-full -mt-2 text-xs leading-5 text-slate-500">
                Schedule times use this convention’s local time zone.
              </p>
              <Field name="startsOn" label="Start date" type="date" required />
              <Field name="endsOn" label="End date" type="date" required />
              <Field
                name="timezone"
                error={fieldError("timezone")}
                label="IANA time zone"
                placeholder="America/Chicago"
                defaultValue="America/Chicago"
                hint="Example: America/Chicago or Europe/London."
                required
              />
              <Field
                name="venue"
                error={fieldError("venue")}
                label="Venue"
                placeholder="Convention center"
                maxLength={160}
              />
              <Field
                name="city"
                error={fieldError("city")}
                minLength={1}
                label="City"
                placeholder="Rosemont"
                required
                maxLength={80}
              />
              <Field
                name="region"
                error={fieldError("region")}
                label="State / region"
                placeholder="Illinois"
                maxLength={80}
              />
              <Field
                name="country"
                error={fieldError("country")}
                minLength={2}
                label="Country"
                placeholder="United States"
                required
                maxLength={80}
                className="sm:col-span-2"
              />
            </fieldset>

            <fieldset className="grid gap-x-5 gap-y-4 sm:grid-cols-2">
              <legend className="mb-1 w-full border-b border-slate-100 pb-3 font-display text-sm font-semibold text-[#091533]">
                3. Organizer and program
              </legend>
              <p className="col-span-full -mt-2 text-xs leading-5 text-slate-500">
                Keep this listing private until the organizer details have been
                checked.
              </p>
              <Field
                name="officialUrl"
                error={fieldError("officialUrl")}
                pattern="https://.+"
                label="Official organizer website"
                type="url"
                placeholder="https://example.org"
                hint="Only HTTPS links are accepted. This stays in the private admin record."
                required
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
                error={fieldError("sourceVerifiedAt")}
                label="Organizer source checked"
                type="date"
                hint="Required before publishing."
                className="sm:col-span-2"
              />
            </fieldset>
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
