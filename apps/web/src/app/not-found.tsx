import type { Metadata } from "next";
import Link from "next/link";

import { CompassPaw } from "@/components/compass-paw";
import { NavPill, PageShell } from "@/components/page-shell";
import { getMessages } from "@/i18n";
import { DEFAULT_LOCALE } from "@/i18n/config";

/**
 * 404. Reached for any unmatched path, so it renders for people who mistyped,
 * followed a stale link, or found an old preview URL — with no session, no
 * query params, and no JS.
 *
 * Renders in English regardless of the URL: a root `not-found.tsx` cannot read
 * `params`, so `/ja/typo` lands here with no locale to read. Every string still
 * comes from the catalog rather than being typed inline, so the day a
 * locale-scoped 404 route exists this becomes a routing change and not a copy
 * migration. The catalogs are already translated.
 */
const messages = getMessages(DEFAULT_LOCALE);

export const metadata: Metadata = {
  title: messages.notFound.title,
  description: messages.notFound.description,
  robots: { index: false, follow: true },
};

// Hrefs are structure and stay in code; the words come from the catalog, in
// the order the catalog lists them.
const ELSEWHERE = (["/", "/support", "/privacy"] as const).map((href, i) => ({
  href,
  ...messages.notFound.links[i],
}));

export default function NotFound() {
  return (
    <PageShell messages={messages} navAside={<NavPill>404</NavPill>}>
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
          {messages.notFound.eyebrow}
        </p>
        <h1 className="mx-auto mt-3 max-w-[18ch] text-balance font-bold text-[clamp(32px,5.2vw,56px)] leading-[1.02] tracking-[-0.02em]">
          {messages.notFound.heading}
        </h1>
        <p className="mx-auto mt-5 max-w-[48ch] text-[16px] text-muted-foreground leading-relaxed">
          {messages.notFound.body}
        </p>

        <Link
          href="/"
          className="mt-9 inline-block rounded-xl bg-primary px-8 py-4 font-bold text-[14px] text-primary-foreground uppercase tracking-[0.14em] transition hover:shadow-[0_0_36px_rgb(15_172_237/0.35)] hover:brightness-110 active:scale-[0.99]"
        >
          {messages.notFound.cta} ←
        </Link>
      </section>

      <section className="mt-16">
        <h2 className="font-tech text-[11px] text-muted-foreground uppercase tracking-[0.24em]">
          {messages.notFound.tryThese}
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
    </PageShell>
  );
}
