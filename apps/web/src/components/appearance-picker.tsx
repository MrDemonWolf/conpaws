"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import type { Messages } from "@/i18n";

export function AppearancePicker({
  labels,
  presentation = "default",
}: {
  labels: Messages["appearance"];
  presentation?: "default" | "inline" | "button";
}) {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  // The server cannot read the saved preference; keep hydration consistent.
  useEffect(() => setMounted(true), []);

  const icon = mounted && resolvedTheme === "dark" ? "moon" : "sun";
  if (presentation === "button") {
    const isDark = mounted && resolvedTheme === "dark";
    return (
      <button
        type="button"
        className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-border text-foreground transition hover:bg-accent"
        aria-label={`${labels.label}: ${isDark ? labels.dark : labels.light}`}
        title={`${labels.label}: ${isDark ? labels.dark : labels.light}`}
        onClick={() => setTheme(isDark ? "light" : "dark")}
      >
        <AppearanceIcon mode={icon} />
      </button>
    );
  }

  if (presentation === "inline") {
    return (
      <div className="flex min-w-0 items-center gap-3 text-base text-foreground">
        <AppearanceIcon mode={icon} />
        <span className="min-w-0 flex-1">{labels.label}</span>
        <select
          className="min-h-[44px] min-w-0 max-w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground disabled:opacity-60"
          aria-label={labels.label}
          value={mounted ? (theme ?? "system") : "system"}
          disabled={!mounted}
          onChange={(event) => setTheme(event.target.value)}
        >
          <option value="system">{labels.system}</option>
          <option value="light">{labels.light}</option>
          <option value="dark">{labels.dark}</option>
        </select>
      </div>
    );
  }

  return (
    <label className="flex min-w-0 max-w-full flex-wrap items-center gap-x-3 gap-y-2 text-base text-foreground">
      <AppearanceIcon mode={icon} />
      <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">
        {labels.label}
      </span>
      <select
        className="min-h-[44px] min-w-0 max-w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground disabled:opacity-60"
        value={mounted ? (theme ?? "system") : "system"}
        disabled={!mounted}
        onChange={(event) => setTheme(event.target.value)}
      >
        <option value="system">{labels.system}</option>
        <option value="light">{labels.light}</option>
        <option value="dark">{labels.dark}</option>
      </select>
    </label>
  );
}

function AppearanceIcon({ mode }: { mode: "sun" | "moon" }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      className="h-4 w-4 shrink-0 text-primary"
    >
      {mode === "moon" ? (
        <path d="M20 15.5A9 9 0 0 1 8.5 4 9 9 0 1 0 20 15.5Z" />
      ) : (
        <>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1 1m12 12 1 1M5 19l1-1M18 6l1-1" />
        </>
      )}
    </svg>
  );
}
