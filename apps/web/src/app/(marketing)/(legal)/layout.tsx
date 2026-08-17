import Link from "next/link";

import { CompassPaw } from "@/components/compass-paw";

/** Shared shell for /privacy and /terms. */
export default function LegalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="mx-auto max-w-[760px] px-6 pb-24">
      <nav className="flex items-center justify-between py-7">
        <Link href="/" className="flex items-center gap-2.5">
          <CompassPaw className="h-7 w-7 text-primary" />
          <b className="font-bold text-[18px] tracking-tight">ConPaws</b>
        </Link>
        <Link
          href="/"
          className="font-tech text-[11px] text-muted-foreground uppercase tracking-[0.18em] transition hover:text-primary"
        >
          ← Back
        </Link>
      </nav>

      <article className="pt-6">{children}</article>

      <footer className="mt-16 border-border border-t pt-6 font-tech text-[10px] text-muted-foreground uppercase tracking-[0.18em]">
        © {new Date().getFullYear()} ConPaws by MrDemonWolf, Inc. · Made with
        paws
      </footer>
    </main>
  );
}
