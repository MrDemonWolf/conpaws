import { CopyButton } from "../../../components/copy-button";
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
import { adminPublicUrl } from "../../../lib/public-url";
import { getInvites, getMembers } from "../../../lib/queries";
import { isFreshSession } from "../../../lib/sign-in";
import { requestSignInCode } from "../../sign-in/actions";
import {
  inviteAdmin,
  resendAdminInvite,
  revokeAdminInvite,
  updateAdminRole,
} from "../actions";

export const metadata = { title: "Team" };

const errors: Record<string, string> = {
  self: "You cannot remove or downgrade your own owner access.",
  "last-owner": "The last active owner cannot be demoted or disabled.",
  invalid: "Enter a valid email and role.",
  member:
    "That person is already on the team. Change their role or access in the list instead.",
  "invite-missing": "That invite no longer exists.",
};

const saves: Record<string, { tone: "success" | "error"; text: string }> = {
  invite: {
    tone: "success",
    text: "Invite sent. They can sign in with that email address now.",
  },
  "invite-unsent": {
    tone: "error",
    text: "Invite saved, but the email didn't send. Copy its sign-in link below and send it yourself.",
  },
  revoked: { tone: "success", text: "Invite withdrawn." },
  role: { tone: "success", text: "Team role saved." },
};

const dateFormat = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeZone: "UTC",
});

function currentTime() {
  return Date.now();
}

export default async function TeamPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const actor = await requireAdmin();
  const isOwner = actor.role === "owner";
  const [members, invites, baseUrl] = isOwner
    ? await Promise.all([getMembers(), getInvites(), adminPublicUrl()])
    : [[], [], null];
  const params = await searchParams;
  const error = typeof params.error === "string" ? errors[params.error] : null;
  const saved = typeof params.saved === "string" ? saves[params.saved] : null;
  const now = currentTime();
  const fresh = isFreshSession(actor, now);

  return (
    <>
      <PageHeading
        eyebrow="Workspace access"
        title="Team"
        description="Invite people by email. They sign in with a one-time code, and their role decides what they can change."
      />
      {params.confirm === "required" ? (
        <Banner tone="error">
          Confirm it's you first. Team changes need a code from the last two
          hours.
        </Banner>
      ) : null}
      {error ? <Banner tone="error">{error}</Banner> : null}
      {saved ? <Banner tone={saved.tone}>{saved.text}</Banner> : null}

      {!isOwner ? (
        <Surface className="p-6">
          <h2 className="font-display text-lg font-bold text-[#091533]">
            Owner permissions required
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Only an owner can view or change the team. Ask an owner if you need
            an access update.
          </p>
        </Surface>
      ) : (
        <>
          {!fresh ? (
            <Surface className="mb-5 flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
              <div>
                <h2 className="font-display text-base font-bold text-[#091533]">
                  Confirm it's you to change the team
                </h2>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  Inviting, removing and changing roles need a code from the
                  last two hours. We'll email one to {actor.email}.
                </p>
              </div>
              <form action={requestSignInCode} className="shrink-0">
                <input type="hidden" name="email" value={actor.email} />
                <input type="hidden" name="next" value="/team" />
                <Button type="submit">Email me a code</Button>
              </form>
            </Surface>
          ) : null}

          <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
            <div className="grid gap-5">
              <Surface className="overflow-hidden">
                <div className="border-b border-slate-100 px-5 py-4 sm:px-7">
                  <h2 className="font-display text-base font-bold text-[#091533]">
                    Team members
                  </h2>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    Changes take effect on the next page load. Disabling someone
                    signs them out everywhere.
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
                          Joined (UTC) {dateFormat.format(member.createdAt)}
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
                      Nobody is on the team yet.
                    </p>
                  ) : null}
                </div>
              </Surface>

              {invites.length > 0 ? (
                <Surface className="overflow-hidden">
                  <div className="border-b border-slate-100 px-5 py-4 sm:px-7">
                    <h2 className="font-display text-base font-bold text-[#091533]">
                      Pending invites
                    </h2>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      An invite turns into a membership the first time that
                      person signs in. The link is safe to share: it only fills
                      in their email, and they still need the code we send them.
                    </p>
                  </div>
                  <ul className="divide-y divide-slate-100">
                    {invites.map((invite) => {
                      const expired = invite.expiresAt <= now;
                      const link = baseUrl
                        ? `${baseUrl}/sign-in#email=${encodeURIComponent(invite.email)}`
                        : null;
                      return (
                        <li
                          key={invite.email}
                          className="grid gap-3 px-5 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:px-7"
                        >
                          <div className="min-w-0">
                            <p className="flex flex-wrap items-center gap-2 break-all text-sm font-semibold text-[#091533]">
                              {invite.email}
                              <StatusPill status={invite.role} />
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                              {expired
                                ? `Expired ${dateFormat.format(invite.expiresAt)} (UTC). Resend to renew it.`
                                : `Invited by ${invite.invitedBy} · expires ${dateFormat.format(invite.expiresAt)} (UTC)`}
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {link && !expired ? (
                              <CopyButton value={link} label="Copy link" />
                            ) : null}
                            <form action={resendAdminInvite}>
                              <input
                                type="hidden"
                                name="email"
                                value={invite.email}
                              />
                              <Button type="submit" variant="secondary">
                                Resend
                              </Button>
                            </form>
                            <form action={revokeAdminInvite}>
                              <input
                                type="hidden"
                                name="email"
                                value={invite.email}
                              />
                              <Button type="submit" variant="quiet">
                                Withdraw
                              </Button>
                            </form>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </Surface>
              ) : null}
            </div>

            <Surface className="p-5 sm:p-6">
              <span className="inline-flex rounded-full bg-violet-50 px-2.5 py-1 text-xs font-bold text-violet-800">
                Owner action
              </span>
              <h2 className="mt-3 font-display text-lg font-bold text-[#091533]">
                Invite someone
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                We email them a link. They sign in with a code sent to that
                address; no account or password to set up. Invites last seven
                days.
              </p>
              <form action={inviteAdmin} className="mt-5 grid gap-4">
                <Field
                  name="email"
                  label="Email address"
                  type="email"
                  autoComplete="off"
                  placeholder="staff@example.org"
                  required
                />
                <SelectField name="role" label="Role" defaultValue="editor">
                  <option value="editor">Editor: edit and publish</option>
                  <option value="owner">Owner: also manages the team</option>
                </SelectField>
                <Button type="submit">Send invite</Button>
              </form>
            </Surface>
          </div>
        </>
      )}
      <div className="mt-5">
        <StatusPill status={actor.role} />
      </div>
    </>
  );
}
