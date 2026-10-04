import { CompassPaw } from "@conpaws/ui/components/compass-paw";
import { ConsoleShell } from "../../components/console-shell";
import { getAdminGate } from "../../lib/auth";

export const dynamic = "force-dynamic";

function AccessMessage({ title, detail }: { title: string; detail: string }) {
  return (
    <main className="grid min-h-screen place-items-center bg-[#091533] p-5 text-white">
      <section className="w-full max-w-md rounded-3xl border border-white/10 bg-white/[0.06] p-8 text-center shadow-2xl">
        <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-[#0faced] text-[#091533]">
          <CompassPaw className="size-9" />
        </span>
        <p className="mt-5 text-xs font-bold uppercase tracking-[0.2em] text-sky-300">
          ConPaws Admin
        </p>
        <h1 className="mt-2 font-display text-2xl font-bold">{title}</h1>
        <p className="mt-3 text-sm leading-6 text-slate-300">{detail}</p>
      </section>
    </main>
  );
}

export default async function ConsoleLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const gate = await getAdminGate();
  if (gate.status === "unavailable") {
    return (
      <AccessMessage
        title="Workspace is not connected"
        detail="The catalog database is not available. Check the local D1 setup or the admin Worker bindings."
      />
    );
  }
  if (gate.status === "identity-required") {
    return (
      <AccessMessage
        title="Sign in through Cloudflare Access"
        detail="This private workspace accepts verified identities from the ConPaws admin Access application."
      />
    );
  }
  if (gate.status === "not-provisioned") {
    return (
      <AccessMessage
        title="Your account needs a role"
        detail={`The verified account ${gate.email} does not have an active ConPaws admin role yet. Ask an owner to grant one.`}
      />
    );
  }
  if (gate.status === "disabled") {
    return (
      <AccessMessage
        title="Admin access is paused"
        detail={`The verified account ${gate.email} is currently disabled in the ConPaws team.`}
      />
    );
  }

  return <ConsoleShell session={gate.session}>{children}</ConsoleShell>;
}
