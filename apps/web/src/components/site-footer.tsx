import Link from "next/link";

import { UPDATES_LABEL } from "@/content/changelog";
import type { Messages } from "@/i18n";
import type { Locale } from "@/i18n/config";

/** The single footer used by every normal website page. */
export function SiteFooter({
  messages,
  locale,
}: {
  messages: Messages;
  locale: Locale;
}) {
  const year = new Date().getFullYear();

  return (
    <footer className="relative z-content mt-24 border-border border-t pt-8">
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
        {/* Keep links at least 44px tall while avoiding extra footer height. */}
        <nav
          aria-label={messages.nav.footerLabel}
          className="-my-3 flex flex-wrap gap-x-5 font-tech text-[12px] text-muted-foreground uppercase tracking-[0.18em]"
        >
          <a
            href="/updates"
            className="inline-flex min-h-11 items-center transition hover:text-primary"
          >
            {UPDATES_LABEL[locale]}
          </a>
          <Link
            href="/design-system"
            className="inline-flex min-h-11 items-center transition hover:text-primary"
          >
            {messages.footer.designSystem}
          </Link>
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
