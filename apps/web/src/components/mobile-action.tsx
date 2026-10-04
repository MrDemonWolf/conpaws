"use client";

import { useEffect, useState } from "react";

/** A thumb action for readers who have scrolled beyond the signup section. */
export function MobileAction({ label }: { label: string }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const target = document.getElementById("waitlist");
    if (!target || !("IntersectionObserver" in window)) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry) return;
      setVisible(!entry.isIntersecting && entry.boundingClientRect.bottom < 0);
    });
    observer.observe(target);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      hidden={!visible}
      data-mobile-action
      className="mobile-action fixed inset-x-0 bottom-0 z-floating border-t border-primary/20 bg-background/95 px-6 py-3 pb-[max(12px,env(safe-area-inset-bottom))] backdrop-blur md:hidden"
    >
      <a
        href="#waitlist"
        className="flex min-h-12 items-center justify-center rounded-xl bg-primary px-4 text-center font-bold text-base text-primary-foreground shadow-[inset_0_1px_0_rgb(255_255_255/0.16)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
      >
        {label}
      </a>
    </div>
  );
}
