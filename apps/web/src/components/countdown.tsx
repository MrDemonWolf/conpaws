"use client";

import { useEffect, useState } from "react";

export function Countdown({
  target,
  labels,
}: {
  target: string;
  labels: {
    days: string;
    hours: string;
    minutes: string;
    seconds: string;
    ariaLabel: string;
  };
}) {
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    const update = () =>
      setRemaining(Math.max(0, Date.parse(target) - Date.now()));
    update();
    const timer = window.setInterval(update, 1_000);
    return () => window.clearInterval(timer);
  }, [target]);

  const seconds = Math.floor((remaining ?? 0) / 1_000);
  const values = [
    [Math.floor(seconds / 86_400), labels.days],
    [Math.floor((seconds % 86_400) / 3_600), labels.hours],
    [Math.floor((seconds % 3_600) / 60), labels.minutes],
    [seconds % 60, labels.seconds],
  ] as const;

  return (
    <div
      role="timer"
      aria-label={labels.ariaLabel}
      className="mt-9 grid grid-cols-4 gap-2 sm:gap-4"
    >
      {values.map(([value, label]) => (
        <div
          key={label}
          className="rounded-2xl border border-primary/15 bg-background/55 px-1 py-4 sm:py-5"
        >
          <span className="block font-tech font-bold text-[clamp(22px,7vw,44px)] text-primary tabular-nums leading-none">
            {remaining === null ? "--" : String(value).padStart(2, "0")}
          </span>
          <span className="mt-2 block font-tech text-[9px] text-muted-foreground uppercase tracking-[0.12em] sm:text-[11px] sm:tracking-[0.18em]">
            {label}
          </span>
        </div>
      ))}
    </div>
  );
}
