import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AuthScreen } from "../../../components/auth-screen";
import { Banner, Button, Field } from "../../../components/ui";
import { getAdminBindings } from "../../../lib/db";
import { attemptCookieName, decodeAttempt } from "../../../lib/sign-in-cookies";
import { requestSignInCode, verifySignInCode } from "../actions";

export const metadata = { title: "Enter your code" };
export const dynamic = "force-dynamic";

// One message for every failed code: telling a wrong code from one that was
// never sent would reveal who is on the team.
const errors: Record<string, string> = {
  format: "Enter the 8 digits from the email.",
  code: "That code didn't work or has expired. Check the newest email, or send a new code.",
  rate: "Too many tries from this network. Wait a minute, then try again.",
};

export default async function SignInCodePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const env = await getAdminBindings();
  const attempt = decodeAttempt(
    (await cookies()).get(attemptCookieName(env))?.value,
  );
  if (!attempt) redirect("/sign-in?error=expired");

  const params = await searchParams;
  const error =
    typeof params.error === "string" ? errors[params.error] : undefined;
  const resent = params.resent === "1";

  return (
    <AuthScreen
      title="Check your email"
      description={
        <>
          If <span className="font-semibold">{attempt.email}</span> can sign in,
          a code is on its way. It expires in 10 minutes and only works in this
          browser.
        </>
      }
    >
      {error ? <Banner tone="error">{error}</Banner> : null}
      {resent && !error ? (
        <Banner tone="info">
          If this address can sign in, a new code is on its way. You can ask for
          one once a minute; use the newest.
        </Banner>
      ) : null}
      <form action={verifySignInCode} className="grid gap-4">
        <Field
          name="code"
          label="8-digit code"
          autoComplete="one-time-code"
          inputMode="numeric"
          pattern="[0-9 \-]*"
          maxLength={12}
          placeholder="1234-5678"
          required
          autoFocus
          className="[&_input]:text-center [&_input]:font-mono [&_input]:text-lg [&_input]:tracking-[0.2em]"
        />
        <Button type="submit" className="w-full">
          Sign in
        </Button>
      </form>
      <div className="mt-5 flex flex-col items-center gap-2 text-sm sm:flex-row sm:justify-center sm:gap-4">
        <form action={requestSignInCode}>
          <input type="hidden" name="email" value={attempt.email} />
          <input type="hidden" name="resend" value="1" />
          {attempt.next ? (
            <input type="hidden" name="next" value={attempt.next} />
          ) : null}
          <Button type="submit" variant="quiet">
            Send a new code
          </Button>
        </form>
        <Button href="/sign-in" variant="quiet">
          Use a different email
        </Button>
      </div>
      <p className="mt-4 text-center text-xs leading-5 text-slate-500">
        Codes can take a minute to arrive. Check spam if you don't see it.
      </p>
    </AuthScreen>
  );
}
