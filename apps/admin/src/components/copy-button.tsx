"use client";

import { useState } from "react";

/** Copies a value, such as an invite's sign-in link, to the clipboard. */
export function CopyButton({
  value,
  label,
  copiedLabel = "Copied",
}: {
  value: string;
  label: string;
  copiedLabel?: string;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 2000);
        } catch {
          window.prompt("Copy this link", value);
        }
      }}
      className="inline-flex min-h-11 items-center justify-center rounded-md border border-input bg-background px-3 text-sm font-medium text-slate-800 shadow-xs transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/25"
    >
      <span aria-live="polite">{copied ? copiedLabel : label}</span>
    </button>
  );
}
