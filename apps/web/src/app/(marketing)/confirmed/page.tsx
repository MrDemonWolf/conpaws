import type { Metadata } from "next";
import Link from "next/link";

import { CompassPaw } from "@/components/compass-paw";
import { PageShell } from "@/components/page-shell";
import { getMessages } from "@/i18n";
import { DEFAULT_LOCALE } from "@/i18n/config";

/**
 * Double opt-in landing page. Currently unreachable: listmonk shows its own
 * confirmation page on lists.mrdemonwolf.com and has no per-request redirect
 * target, so nothing links here today. Kept because it is where a custom
 * confirmation destination would go if listmonk's page is ever replaced.
 *
 * Historically the ESP redirected
 * every confirming subscriber here, so this route is the last step of signup —
 * it has to render for anyone, with no query params, no session, and no JS.
 *
 * Deliberately static: the confirmation itself already happened at the ESP
 * before the redirect, so there is nothing to verify or fetch here. Reading a
 * token off the URL would only invite people to think this page decides
 * anything.
 */

const messages = getMessages(DEFAULT_LOCALE);

export const metadata: Metadata = {
  title: messages.confirmed.title,
  description: messages.confirmed.description,
  // A confirmation endpoint has no search value and shouldn't collect
  // impressions against the landing page it duplicates copy from.
  robots: { index: false, follow: false },
};

// Numbering is structure and stays in code; the words come from the catalog,
// where they were already translated into all 23 languages and read by nothing.
const NEXT = messages.confirmed.cards.map((card, i) => ({
  n: String(i + 1).padStart(2, "0"),
  ...card,
}));

export default function Confirmed() {
  return (
    <PageShell messages={messages}>
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
    </PageShell>
  );
}
