import {
  Banner,
  Button,
  Field,
  PageHeading,
  Surface,
} from "../../../components/ui";
import { requireAdmin } from "../../../lib/auth";
import { safeNextPath } from "../../../lib/sign-in-cookies";
import { saveDisplayName } from "./actions";

export const metadata = { title: "Account" };

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const actor = await requireAdmin();
  const params = await searchParams;
  const setup = !actor.displayName && params.setup === "1";
  const next = safeNextPath(
    typeof params.next === "string" ? params.next : null,
  );

  return (
    <>
      <PageHeading title={setup ? "Set your display name" : "Account"} />
      <Surface className="max-w-xl p-5 sm:p-6">
        <form action={saveDisplayName} className="grid gap-4">
          {params.saved === "1" ? (
            <Banner tone="success">Display name saved.</Banner>
          ) : null}
          {next ? <input type="hidden" name="next" value={next} /> : null}
          {setup ? <input type="hidden" name="setup" value="1" /> : null}
          <Field
            label="Display name"
            name="displayName"
            autoComplete="nickname"
            defaultValue={actor.displayName ?? ""}
            hint="This is how your name appears to the admin team."
            error={
              params.error === "name"
                ? "Enter a display name of 1 to 80 characters."
                : undefined
            }
            maxLength={80}
            required
          />
          <p className="break-all text-sm text-muted-foreground">
            <span className="font-semibold">Sign-in email</span> {actor.email}
          </p>
          <Button type="submit" className="justify-self-start">
            {setup ? "Continue" : "Save display name"}
          </Button>
        </form>
      </Surface>
    </>
  );
}
