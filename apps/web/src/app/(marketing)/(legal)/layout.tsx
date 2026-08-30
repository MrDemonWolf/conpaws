import Link from "next/link";

import { PageShell } from "@/components/page-shell";
import { getMessages } from "@/i18n";
import { DEFAULT_LOCALE } from "@/i18n/config";

/**
 * Shared shell for the public legal and support pages.
 *
 * The nav and footer come from `PageShell` so these cannot drift away from the
 * landing page again — they had, keeping a 28px logo and no language switcher
 * through the redesign. The MDX inside is English-only, which is why the shell
 * is asked for the default locale rather than one read from the URL.
 */
const messages = getMessages(DEFAULT_LOCALE);

export default function LegalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <PageShell
      narrow
      messages={messages}
      navAside={
        <Link
          href="/"
          className="inline-flex min-h-11 items-center font-tech text-[11px] text-muted-foreground uppercase tracking-[0.18em] transition hover:text-primary"
        >
          ← {messages.nav.back}
        </Link>
      }
    >
      <article className="pt-6">{children}</article>
    </PageShell>
  );
}
