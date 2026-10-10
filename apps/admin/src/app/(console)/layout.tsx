import { redirect } from "next/navigation";
import { AuthScreen } from "../../components/auth-screen";
import { ConsoleShell } from "../../components/console-shell";
import { Button } from "../../components/ui";
import { getAdminGate } from "../../lib/auth";
import { signOut } from "../sign-in/actions";

export const dynamic = "force-dynamic";

function SignOutForm() {
  return (
    <form action={signOut}>
      <Button type="submit" variant="secondary" className="w-full">
        Sign out
      </Button>
    </form>
  );
}

export default async function ConsoleLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const gate = await getAdminGate();
  if (gate.status === "identity-required") redirect("/sign-in");
  if (gate.status === "unavailable") {
    return (
      <AuthScreen
        title="Workspace is not connected"
        description="The catalog database is not available. Check the local D1 setup and migrations, or the admin Worker bindings."
      />
    );
  }
  if (gate.status === "not-provisioned") {
    return (
      <AuthScreen
        title="Your account needs a role"
        description={`${gate.email} isn't on the ConPaws Admin team. Ask an owner to invite you.`}
      >
        <SignOutForm />
      </AuthScreen>
    );
  }
  if (gate.status === "disabled") {
    return (
      <AuthScreen
        title="Admin access is paused"
        description={`${gate.email} is disabled on the ConPaws Admin team. Ask an owner to turn it back on.`}
      >
        <SignOutForm />
      </AuthScreen>
    );
  }

  return <ConsoleShell session={gate.session}>{children}</ConsoleShell>;
}
