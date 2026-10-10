import { redirect } from "next/navigation";
import { AuthScreen } from "../../components/auth-screen";
import { EmailFromLink } from "../../components/email-from-link";
import { Banner, Button, Field } from "../../components/ui";
import { getAdminGate } from "../../lib/auth";
import { safeNextPath } from "../../lib/sign-in-cookies";
import { requestSignInCode } from "./actions";

export const metadata = { title: "Sign in" };
export const dynamic = "force-dynamic";

const errors: Record<string, string> = {
  email: "Enter a valid email address.",
  rate: "Too many tries from this network. Wait a minute, then try again.",
  expired: "That sign-in expired. Enter your email to get a new code.",
  denied:
    "This email doesn't have access to ConPaws Admin. Ask an owner for an invite.",
  disabled:
    "Your access to ConPaws Admin is paused. Ask an owner to turn it back on.",
  unavailable: "Sign-in isn't available right now. Try again in a few minutes.",
  "sign-out":
    "You're signed out on this device, but ConPaws couldn't confirm it on the server. Sign in, then use Sign out on all devices.",
  "sign-out-all":
    "You're signed out here, but ConPaws couldn't sign you out on your other devices. Sign in again and retry.",
};

function param(value: string | string[] | undefined) {
  return typeof value === "string" ? value : "";
}

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const next = safeNextPath(param(params.next));
  const gate = await getAdminGate();
  const error = errors[param(params.error)];
  // A signed-in owner comes here to confirm it's them before a team change,
  // or to read why that failed. Anyone else already signed in has nothing to
  // do here.
  const confirming = gate.status === "authorized" && next === "/team";
  if (gate.status === "authorized" && !confirming && !error) redirect("/");

  // Never read the address from the query string: URLs end up in request
  // logs. Invite links put it after `#`, which EmailFromLink reads instead.
  const email = gate.status === "authorized" ? gate.session.email : "";
  const signedOut = param(params["signed-out"]);

  return (
    <AuthScreen
      title={confirming ? "Confirm it's you" : "Sign in"}
      description={
        confirming
          ? "Team changes need a fresh code. We'll email one to you."
          : "Enter your email and we'll send you an 8-digit code. There's no password."
      }
    >
      {error ? <Banner tone="error">{error}</Banner> : null}
      {signedOut && !error ? (
        <Banner tone="success">
          {signedOut === "all"
            ? "You're signed out on every device."
            : "You're signed out."}
        </Banner>
      ) : null}
      <form action={requestSignInCode} className="grid gap-4">
        {next ? <input type="hidden" name="next" value={next} /> : null}
        <Field
          id="sign-in-email"
          name="email"
          label="Email address"
          type="email"
          autoComplete="email"
          inputMode="email"
          defaultValue={email}
          placeholder="you@example.com"
          required
          autoFocus
        />
        <Button type="submit" className="w-full">
          Email me a code
        </Button>
      </form>
      <EmailFromLink inputId="sign-in-email" />
      <p className="mt-5 text-center text-xs leading-5 text-slate-500">
        Only invited team members can sign in. If you need access, ask an owner
        to invite you.
      </p>
    </AuthScreen>
  );
}
