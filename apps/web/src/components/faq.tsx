import type { ReactNode } from "react";

import Faq from "@/content/faq.mdx";

/**
 * Renders `content/faq.mdx` as an accordion.
 *
 * The MDX file wraps each question in `<FaqItem q="…">` and writes the answer
 * as ordinary markdown. This module supplies `FaqItem` through the MDX
 * components map, so the content file imports nothing and whoever edits it
 * never sees a `<details>`, an `open:` variant, or a rotation transform.
 *
 * Why a wrapper tag rather than splitting on `##` headings: an accordion has
 * to know where each answer begins and ends, and a compiled MDX component is
 * opaque — `Children.toArray(<Faq />)` returns the element itself, not the
 * headings and paragraphs inside it, so a heading-splitting version rendered
 * an empty list. Introspecting the output would mean rendering it first,
 * which a server component cannot do to itself. One tag per question is the
 * smallest honest price for keeping the answers in markdown.
 *
 * Borders come from `not-first:` rather than an index, because MDX hands these
 * to us as siblings and there is no map to carry a counter.
 */

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

export function FaqSection() {
  return (
    <div className="mt-8 overflow-hidden rounded-2xl border border-border">
      <Faq
        components={{
          FaqItem,
          // Scoped to this render. The globals in `mdx-components.tsx` style
          // the legal pages, where a paragraph is body copy; here every
          // paragraph sits inside a <details> and needs the answer padding.
          p: ({ children }: { children?: ReactNode }) => (
            <p className="max-w-[68ch] px-6 pb-5 text-[14.5px] text-muted-foreground leading-relaxed">
              {children}
            </p>
          ),
          a: ({ href, children }: { href?: string; children?: ReactNode }) => (
            <a
              href={href}
              rel="noopener"
              className="text-primary underline-offset-2 hover:underline"
            >
              {children}
            </a>
          ),
          code: ({ children }: { children?: ReactNode }) => (
            <code className="font-tech text-[13px] text-foreground">
              {children}
            </code>
          ),
        }}
      />
    </div>
  );
}
