import { redirect } from "next/navigation";
import { AuthScreen } from "../../components/auth-screen";
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
  // A signed-in owner comes here only to confirm it's them before a team
  // change; anyone else already signed in has nothing to do here.
  const confirming = gate.status === "authorized" && next === "/team";
  if (gate.status === "authorized" && !confirming) redirect("/");

  const email =
    gate.status === "authorized" ? gate.session.email : param(params.email);
  const error = errors[param(params.error)];
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
      <p className="mt-5 text-center text-xs leading-5 text-slate-500">
        Only invited team members can sign in. If you need access, ask an owner
        to invite you.
      </p>
    </AuthScreen>
  );
}
