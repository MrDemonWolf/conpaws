import { cn } from "@conpaws/ui/lib/utils";
import Link from "next/link";
import type { ReactNode } from "react";

import { CompassPaw } from "@/components/compass-paw";
import { LanguageSwitcher } from "@/components/language-switcher";
import type { Messages } from "@/i18n";
import { DEFAULT_LOCALE, type Locale } from "@/i18n/config";

/**
 * Nav and footer for every page that is not the landing page.
 *
 * The 404, `/confirmed` and the legal pages each carried their own copy of this
 * chrome, and the copies had drifted: the landing page got a redesign and 23
 * locales, the other three kept a 28px logo, an 18px wordmark, no language
 * switcher, and three different footers — one of which
 * (`/confirmed`) dropped the `min-h-11` that the other two document as the
 * WCAG 2.5.8 target, leaving its footer links about 18px tall.
 *
 * Sharing the chrome is what stops that happening again. Every string here
 * comes from `nav.*` and `footer.*`, which were already translated.
 */
export function PageShell({
  locale = DEFAULT_LOCALE,
  messages,
  navAside,
  narrow = false,
  children,
}: {
  locale?: Locale;
  messages: Messages;
  /**
   * Sits left of the language switcher. Defaults to the landing page's
   * "Est. 2025" pill; pages pass their own marker instead ("404", "← Back").
   */
  navAside?: ReactNode;
  /** Legal pages read as prose and use a 760px measure, not the 1120px grid. */
  narrow?: boolean;
  children: ReactNode;
}) {
  return (
    <main
      lang={locale}
      className={cn(
        "relative mx-auto px-6 pb-24",
        narrow ? "max-w-[760px]" : "max-w-[1120px]",
      )}
    >
      <nav className="relative z-20 flex items-center justify-between py-7">
        <Link href="/" className="flex items-center gap-3">
          <CompassPaw className="h-10 w-10 text-primary" />
          <b className="font-bold text-[22px] tracking-tight">ConPaws</b>
        </Link>
        <span className="flex items-center gap-3">
          {navAside ?? (
            <span className="hidden rounded-full border border-border px-3 py-1 font-tech text-[11px] text-muted-foreground uppercase tracking-[0.2em] sm:inline">
              {messages.nav.established}
            </span>
          )}
          <LanguageSwitcher
            current={locale}
            label={messages.nav.languageLabel}
          />
        </span>
      </nav>

      {children}

      <PageFooter messages={messages} />
    </main>
  );
}

/** The landing page's footer, minus its decorative oversized wordmark. */
function PageFooter({ messages }: { messages: Messages }) {
  const year = new Date().getFullYear();

  return (
    <footer className="relative z-10 mt-24 border-border border-t pt-8">
      <div className="flex flex-wrap items-center justify-between gap-6">
        <p className="font-tech text-[11px] text-muted-foreground uppercase tracking-[0.18em]">
          {messages.footer.copyright.replace("{year}", String(year))}{" "}
          <a
            href="https://www.mrdemonwolf.com"
            rel="noopener"
            className="text-primary transition hover:underline"
          >
            {messages.footer.company}
          </a>
        </p>
        {/* `min-h-11` is the 44px WCAG 2.5.8 target; at 12px these are ~18px
            tall without it. `-my-3` cancels the height so spacing is unchanged.
            The MrDemonWolf link above is exempt — it sits inside a sentence. */}
        <nav className="-my-3 flex gap-5 font-tech text-[12px] text-muted-foreground uppercase tracking-[0.18em]">
          <a
            href="/support"
            className="inline-flex min-h-11 items-center transition hover:text-primary"
          >
            {messages.footer.support}
          </a>
          <a
            href="/privacy"
            className="inline-flex min-h-11 items-center transition hover:text-primary"
          >
            {messages.footer.privacy}
          </a>
          <a
            href="/terms"
            className="inline-flex min-h-11 items-center transition hover:text-primary"
          >
            {messages.footer.terms}
          </a>
        </nav>
      </div>
    </footer>
  );
}

/** The pill the landing page uses for "Est. 2025", for page-specific markers. */
export function NavPill({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full border border-border px-3 py-1 font-tech text-[11px] text-muted-foreground uppercase tracking-[0.2em]">
      {children}
    </span>
  );
}
