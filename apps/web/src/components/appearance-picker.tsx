"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import type { Messages } from "@/i18n";

export function AppearancePicker({
  labels,
}: {
  labels: Messages["appearance"];
}) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  // The server cannot read the saved preference; keep hydration consistent.
  useEffect(() => setMounted(true), []);

  return (
    <label className="flex min-w-0 max-w-full flex-wrap items-center gap-x-3 gap-y-2 text-base text-foreground">
      <span className="min-w-0 [overflow-wrap:anywhere]">{labels.label}</span>
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
