import type { MDXComponents } from "mdx/types";

/**
 * Required by @next/mdx in the App Router — MDX pages refuse to render
 * without this file. Maps markdown elements onto the site's design system so
 * the legal pages inherit the brand without any per-page styling.
 */
export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    h1: ({ children }) => (
      <h1 className="mt-2 mb-6 font-bold text-[clamp(30px,4.4vw,44px)] leading-tight tracking-[-0.02em]">
        {children}
      </h1>
    ),
    h2: ({ children }) => (
      <h2 className="mt-12 mb-4 border-border border-b pb-2 font-bold text-[22px] tracking-tight">
        {children}
      </h2>
    ),
    h3: ({ children }) => (
      <h3 className="mt-8 mb-3 font-bold text-[17px] tracking-tight">
        {children}
      </h3>
    ),
    p: ({ children }) => (
      <p className="mb-4 text-[15px] text-muted-foreground leading-relaxed">
        {children}
      </p>
    ),
    ul: ({ children }) => (
      <ul className="mb-4 list-disc space-y-1.5 pl-6 text-[15px] text-muted-foreground leading-relaxed">
        {children}
      </ul>
    ),
    ol: ({ children }) => (
      <ol className="mb-4 list-decimal space-y-1.5 pl-6 text-[15px] text-muted-foreground leading-relaxed">
        {children}
      </ol>
    ),
    li: ({ children }) => <li>{children}</li>,
    strong: ({ children }) => (
      <strong className="font-semibold text-foreground">{children}</strong>
    ),
    a: ({ href, children }) => (
      <a
        href={href}
        className="text-primary underline-offset-2 hover:underline"
      >
        {children}
      </a>
    ),
    table: ({ children }) => (
      <div className="mb-6 overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-left text-[14px]">{children}</table>
      </div>
    ),
    thead: ({ children }) => (
      <thead className="bg-card font-tech text-[11px] text-muted-foreground uppercase tracking-[0.14em]">
        {children}
      </thead>
    ),
    th: ({ children }) => <th className="px-4 py-3">{children}</th>,
    td: ({ children }) => (
      <td className="border-border border-t px-4 py-3 text-muted-foreground">
        {children}
      </td>
    ),
    hr: () => <hr className="my-10 border-border" />,
    blockquote: ({ children }) => (
      <blockquote className="mb-4 border-primary/50 border-l-2 pl-4 text-muted-foreground italic">
        {children}
      </blockquote>
    ),
    ...components,
  };
}
