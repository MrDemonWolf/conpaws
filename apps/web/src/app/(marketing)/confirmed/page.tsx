import type { Metadata } from "next";
import Link from "next/link";

import { CompassPaw } from "@/components/compass-paw";

/**
 * Double opt-in landing page. The ESP (Brevo today, Listmonk next) redirects
 * every confirming subscriber here, so this route is the last step of signup —
 * it has to render for anyone, with no query params, no session, and no JS.
 *
 * Deliberately static: the confirmation itself already happened at the ESP
 * before the redirect, so there is nothing to verify or fetch here. Reading a
 * token off the URL would only invite people to think this page decides
 * anything.
 */

export const metadata: Metadata = {
  title: "You're on the list",
  description: "Your ConPaws beta waitlist spot is confirmed.",
  // A confirmation endpoint has no search value and shouldn't collect
  // impressions against the landing page it duplicates copy from.
  robots: { index: false, follow: false },
};

const NEXT = [
  {
    n: "01",
    title: "Nothing to do now",
    body: "Your spot is held. We won't email you again until the beta is actually open.",
  },
  {
    n: "02",
    title: "One email, then an invite",
    body: "When TestFlight and Play testing go live, you get the link — iOS and Android together.",
  },
  {
    n: "03",
    title: "Leave whenever",
    body: "Every email we send carries an unsubscribe link. One click, no questions.",
  },
] as const;

export default function Confirmed() {
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
          Coming soon
        </span>
      </nav>

      <section className="relative mt-10 overflow-hidden rounded-3xl border border-primary/40 bg-primary/10 px-6 py-14 text-center sm:px-12">
        <CompassPaw
          aria-hidden="true"
          className="-left-10 -bottom-10 absolute h-[180px] w-[180px] rotate-[-15deg] text-primary opacity-[0.07]"
        />
        <CompassPaw
          aria-hidden="true"
          className="-right-8 -top-12 absolute h-[160px] w-[160px] rotate-[20deg] text-primary opacity-[0.07]"
        />

        <p className="font-tech text-[12px] text-primary uppercase tracking-[0.3em]">
          Badge printed
        </p>
        <h1 className="mx-auto mt-3 max-w-[16ch] text-balance font-bold text-[clamp(32px,5.2vw,56px)] leading-[1.02] tracking-[-0.02em]">
          You&rsquo;re on the list
        </h1>
        <p className="mx-auto mt-5 max-w-[48ch] text-[16px] text-muted-foreground leading-relaxed">
          Your email is confirmed and your beta spot is locked in. That&rsquo;s
          the whole process — nothing else is needed from you.
        </p>

        <Link
          href="/"
          className="mt-9 inline-block rounded-xl bg-primary px-8 py-4 font-bold text-[14px] text-primary-foreground uppercase tracking-[0.14em] transition hover:shadow-[0_0_36px_rgb(15_172_237/0.35)] hover:brightness-110 active:scale-[0.99]"
        >
          Back to the program ←
        </Link>
      </section>

      <section className="mt-20">
        <div className="max-w-[560px]">
          <p className="font-tech text-[12px] text-primary uppercase tracking-[0.3em]">
            What happens next
          </p>
          <h2 className="mt-3 text-balance font-bold text-[clamp(26px,3.6vw,36px)] leading-[1.05] tracking-[-0.02em]">
            Three things, and none of them are chores
          </h2>
        </div>

        <ol className="mt-10 grid gap-5 sm:grid-cols-3">
          {NEXT.map((step) => (
            <li
              key={step.n}
              className="rounded-2xl border border-border bg-card/60 p-6"
            >
              <p className="font-tech text-[12px] text-primary tracking-[0.24em]">
                {step.n}
              </p>
              <h3 className="mt-3 font-bold text-[17px] tracking-tight">
                {step.title}
              </h3>
              <p className="mt-2 text-[14px] text-muted-foreground leading-relaxed">
                {step.body}
              </p>
            </li>
          ))}
        </ol>
      </section>

      <p className="mx-auto mt-14 max-w-[52ch] text-center text-[13.5px] text-muted-foreground leading-relaxed">
        Didn&rsquo;t mean to sign up? Use the unsubscribe link in any email from
        us, or write to{" "}
        <a
          href="mailto:hello@conpaws.com"
          className="text-primary hover:underline"
        >
          hello@conpaws.com
        </a>{" "}
        and we&rsquo;ll delete your record. See the{" "}
        <a href="/privacy" className="text-primary hover:underline">
          privacy policy
        </a>{" "}
        for what we store.
      </p>

      <footer className="mt-20 border-border border-t pt-6">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <span className="flex items-center gap-2">
              <CompassPaw className="h-5 w-5 text-primary" />
              <b className="text-[15px] tracking-tight">ConPaws</b>
              <span className="font-tech text-[11px] text-muted-foreground uppercase tracking-[0.16em]">
                by{" "}
                <a
                  href="https://www.mrdemonwolf.com"
                  rel="noopener"
                  className="text-primary transition hover:underline"
                >
                  MrDemonWolf,&nbsp;Inc.
                </a>
              </span>
            </span>
            <p className="mt-2 font-tech text-[11px] text-muted-foreground uppercase tracking-[0.18em]">
              © {new Date().getFullYear()} MrDemonWolf, Inc. All rights
              reserved.
            </p>
          </div>
          <nav className="flex gap-5 font-tech text-[12px] text-muted-foreground uppercase tracking-[0.18em]">
            <a href="/privacy" className="transition hover:text-primary">
              Privacy
            </a>
            <a href="/terms" className="transition hover:text-primary">
              Terms
            </a>
          </nav>
        </div>
      </footer>
    </main>
  );
}
