import type { ReactNode } from "react";

import { parseInline } from "@/i18n";

/**
 * Renders the FAQ accordion from the locale catalog.
 *
 * This used to render `content/faq.mdx` through the MDX components map, which
 * was the right call while the site was English-only: answers are prose, and
 * markdown beats JSX for prose.
 *
 * It reads from the catalog now because the FAQ has to exist in 23 languages.
 * Keeping MDX for English and JSON for everyone else would mean two sources
 * for the same six answers, and the English one would drift the first time
 * somebody edited a question without touching the other 22 files. One source
 * that all locales share is worth losing the MDX authoring for.
 *
 * The cost is that answers are now plain strings with a two-feature inline
 * syntax (`[label](url)` and `` `code` ``) instead of full markdown. That is
 * all the answers ever used. `content/faq.mdx` is now unreferenced and should
 * be deleted once this has been reviewed.
 */

function Answer({ text }: { text: string }) {
  return (
    <p className="max-w-[68ch] px-6 pb-5 text-[14.5px] text-muted-foreground leading-relaxed">
      {parseInline(text).map((part, i) => {
        if (part.kind === "link") {
          return (
            <a
              // biome-ignore lint/suspicious/noArrayIndexKey: parts are positional within one immutable string
              key={i}
              href={part.href}
              rel="noopener"
              className="text-primary underline-offset-2 hover:underline"
            >
              {part.value}
            </a>
          );
        }
        if (part.kind === "code") {
          return (
            // biome-ignore lint/suspicious/noArrayIndexKey: as above
            <code key={i} className="font-tech text-[13px] text-foreground">
              {part.value}
            </code>
          );
        }
        // biome-ignore lint/suspicious/noArrayIndexKey: as above
        return <span key={i}>{part.value}</span>;
      })}
    </p>
  );
}

function FaqItem({ q, children }: { q: string; children?: ReactNode }) {
  return (
    <details className="group bg-card/40 not-first:border-border not-first:border-t open:bg-card">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-6 py-5 font-bold text-[15.5px] tracking-tight transition hover:text-primary [&::-webkit-details-marker]:hidden">
        {q}
        <span
          aria-hidden="true"
          className="text-[18px] text-primary transition group-open:rotate-45"
        >
          +
        </span>
      </summary>
      {children}
    </details>
  );
}

export function FaqSection({
  items,
}: {
  items: readonly { q: string; a: string }[];
}) {
  return (
    <div className="mt-8 overflow-hidden rounded-2xl border border-border">
      {items.map((item) => (
        <FaqItem key={item.q} q={item.q}>
          <Answer text={item.a} />
        </FaqItem>
      ))}
    </div>
  );
}
