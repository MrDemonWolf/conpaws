import {
  Banner,
  Button,
  Field,
  PageHeading,
  SelectField,
  StatusPill,
  Surface,
} from "../../../components/ui";
import { requireAdmin } from "../../../lib/auth";
import { getMembers } from "../../../lib/queries";
import { grantAdminRole, updateAdminRole } from "../actions";

export default async function TeamPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const actor = await requireAdmin();
  const members = actor.role === "owner" ? await getMembers() : [];
  const params = await searchParams;
  const error = typeof params.error === "string" ? params.error : "";
  const saved = typeof params.saved === "string" ? params.saved : "";

  return (
    <>
      <PageHeading
        eyebrow="Workspace access"
        title="Team"
        description="Cloudflare Access decides who can reach this site. ConPaws roles decide what each verified person can change."
      />
      {error === "self" ? (
        <Banner tone="error">
          You cannot remove or downgrade your own owner access.
        </Banner>
      ) : null}
      {error === "last-owner" ? (
        <Banner tone="error">
          The last active owner cannot be demoted or disabled.
        </Banner>
      ) : null}
      {error === "invalid" ? (
        <Banner tone="error">Enter a valid email and role.</Banner>
      ) : null}
      {saved ? (
        <Banner tone="success">
          Team role saved. New staff also need to be allowed by the Cloudflare
          Access application policy.
        </Banner>
      ) : null}

      {actor.role !== "owner" ? (
        <Surface className="p-6">
          <h2 className="font-display text-lg font-bold text-[#091533]">
            Owner permissions required
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Only an owner can view or change team roles. Ask an owner if you
            need an access update.
          </p>
        </Surface>
      ) : (
        <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <Surface className="overflow-hidden">
            <div className="border-b border-slate-100 px-5 py-4 sm:px-7">
              <h2 className="font-display text-base font-bold text-[#091533]">
                Admin members
              </h2>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                Role changes take effect on the next request.
              </p>
            </div>
            <div className="divide-y divide-slate-100">
              {members.map((member) => (
                <form
                  action={updateAdminRole}
                  key={member.email}
                  className="grid gap-3 px-5 py-4 sm:grid-cols-[minmax(0,1fr)_130px_140px_auto] sm:items-end sm:px-7"
                >
                  <input type="hidden" name="email" value={member.email} />
                  <div className="min-w-0 pb-1">
                    <p className="break-all text-sm font-semibold text-[#091533]">
                      {member.email}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Added{" "}
                      {new Intl.DateTimeFormat("en-US", {
                        dateStyle: "medium",
                        timeZone: "UTC",
                      }).format(member.createdAt)}
                    </p>
                  </div>
                  <SelectField
                    name="role"
                    label="Role"
                    defaultValue={member.role}
                  >
                    <option value="owner">Owner</option>
                    <option value="editor">Editor</option>
                  </SelectField>
                  <SelectField
                    name="status"
                    label="Access"
                    defaultValue={member.status}
                  >
                    <option value="active">Active</option>
                    <option value="disabled">Disabled</option>
                  </SelectField>
                  <Button type="submit" variant="secondary">
                    Save
                  </Button>
                </form>
              ))}
              {members.length === 0 ? (
                <p className="p-6 text-sm text-slate-600">
                  No active staff accounts are configured.
                </p>
              ) : null}
            </div>
          </Surface>

          <Surface className="p-5 sm:p-6">
            <span className="inline-flex rounded-full bg-violet-50 px-2.5 py-1 text-xs font-bold text-violet-800">
              Owner action
            </span>
            <h2 className="mt-3 font-display text-lg font-bold text-[#091533]">
              Grant an admin role
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              First add the person to the Cloudflare Access allow policy. Then
              grant them an in-app role here.
            </p>
            <form action={grantAdminRole} className="mt-5 grid gap-4">
              <Field
                name="email"
                label="Email address"
                type="email"
                placeholder="staff@example.org"
                required
              />
              <SelectField name="role" label="Role" defaultValue="editor">
                <option value="editor">
                  Editor · manage conventions and publish
                </option>
                <option value="owner">Owner · manage team and publish</option>
              </SelectField>
              <Button type="submit">Grant access</Button>
            </form>
            <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-950">
              This records a role only. It does not send email or change
              Cloudflare Access policy.
            </div>
          </Surface>
        </div>
      )}
      <div className="mt-5">
        <StatusPill status={actor.role} />
      </div>
    </>
  );
}
