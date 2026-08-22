import type { Metadata } from "next";
import Link from "next/link";

import { CompassPaw } from "@/components/compass-paw";

/**
 * 404. Reached for any unmatched path, so it renders for people who mistyped,
 * followed a stale link, or found an old preview URL — with no session, no
 * query params, and no JS.
 */

export const metadata: Metadata = {
  title: "Page not found",
  description: "That page isn't on the program.",
  robots: { index: false, follow: true },
};

const ELSEWHERE = [
  {
    href: "/",
    label: "The main program",
    hint: "What ConPaws is, and the waitlist",
  },
  {
    href: "/support",
    label: "Support",
    hint: "If something is actually broken",
  },
  {
    href: "/privacy",
    label: "Privacy Policy",
    hint: "What we store, and what we don't",
  },
] as const;

export default function NotFound() {
  return (
    <main className="relative mx-auto max-w-[1120px] px-6 pb-28">
      <nav className="relative z-20 flex items-center justify-between py-7">
        <Link href="/" className="flex items-baseline gap-2.5">
          <span className="flex items-center gap-2.5">
            <CompassPaw className="h-7 w-7 text-primary" />
            <b className="font-bold text-[18px] tracking-tight">ConPaws</b>
          </span>
          <span className="hidden font-tech text-[10px] text-muted-foreground uppercase tracking-[0.18em] sm:inline">
            by MrDemonWolf,&nbsp;Inc.
          </span>
        </Link>
        <span className="rounded-full border border-border px-3 py-1 font-tech text-[11px] text-muted-foreground uppercase tracking-[0.2em]">
          404
        </span>
      </nav>

      <section className="relative mt-10 overflow-hidden rounded-3xl border border-border bg-card px-6 py-14 text-center sm:px-12">
        <CompassPaw
          aria-hidden="true"
          className="-left-10 -bottom-10 absolute h-[180px] w-[180px] rotate-[-15deg] text-muted-foreground opacity-[0.06]"
        />
        <CompassPaw
          aria-hidden="true"
          className="-right-8 -top-12 absolute h-[160px] w-[160px] rotate-[20deg] text-muted-foreground opacity-[0.06]"
        />

        <p className="font-tech text-[12px] text-muted-foreground uppercase tracking-[0.3em]">
          Wrong room
        </p>
        <h1 className="mx-auto mt-3 max-w-[18ch] text-balance font-bold text-[clamp(32px,5.2vw,56px)] leading-[1.02] tracking-[-0.02em]">
          That page isn&rsquo;t on the program
        </h1>
        <p className="mx-auto mt-5 max-w-[48ch] text-[16px] text-muted-foreground leading-relaxed">
          The link may be out of date, or the address may have a typo in it.
          Nothing is broken on your end.
        </p>

        <Link
          href="/"
          className="mt-9 inline-block rounded-xl bg-primary px-8 py-4 font-bold text-[14px] text-primary-foreground uppercase tracking-[0.14em] transition hover:shadow-[0_0_36px_rgb(15_172_237/0.35)] hover:brightness-110 active:scale-[0.99]"
        >
          Back to the program ←
        </Link>
      </section>

      <section className="mt-16">
        <h2 className="font-tech text-[11px] text-muted-foreground uppercase tracking-[0.24em]">
          Try one of these
        </h2>
        <ul className="mt-5 grid gap-3 sm:grid-cols-3">
          {ELSEWHERE.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className="block h-full rounded-2xl border border-border bg-card px-5 py-5 transition hover:border-primary/50"
              >
                <span className="font-bold text-[15px]">{item.label}</span>
                <span className="mt-1 block text-[14px] text-muted-foreground leading-relaxed">
                  {item.hint}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
