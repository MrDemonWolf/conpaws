import { cn } from "@conpaws/ui/lib/utils";
import type { ReactNode } from "react";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import type { Messages } from "@/i18n";
import { DEFAULT_LOCALE, type Locale } from "@/i18n/config";

/**
 * Shared chrome for pages that use the standard content shell. The landing
 * page uses the same SiteHeader and SiteFooter around its custom layout.
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
   * Optional page-specific marker above the page content.
   */
  navAside?: ReactNode;
  /** Legal pages read as prose and use a 760px measure, not the 1120px grid. */
  narrow?: boolean;
  children: ReactNode;
}) {
  return (
    // See landing.tsx: <main> wrapping the header and footer left the page with
    // no banner landmark and no contentinfo, so landmark navigation offered
    // only "main" -- on the legal pages and the 404 as well.
    <>
      <a
        href="#main"
        className="sr-only rounded-lg bg-primary px-4 py-2 font-tech text-primary-foreground text-[12px] uppercase tracking-[0.18em] focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-skip"
      >
        {messages.nav.skipToContent}
      </a>
      <SiteHeader locale={locale} messages={messages} />
      <div
        lang={locale}
        className="marketing-shell relative z-content isolate mx-auto max-w-[1120px] px-6 pb-24"
      >
        <main id="main" className={cn(narrow && "mx-auto max-w-[760px]")}>
          {navAside ? <div className="pt-6">{navAside}</div> : null}
          {children}
        </main>

        <SiteFooter messages={messages} locale={locale} />
      </div>
    </>
  );
}

/** A restrained pill for page-specific navigation markers. */
export function NavPill({ children }: { children: ReactNode }) {
  return (
    <span className="hidden rounded-full border border-border px-3 py-1 font-tech text-[11px] text-muted-foreground uppercase tracking-[0.2em] sm:inline-flex">
      {children}
    </span>
  );
}
