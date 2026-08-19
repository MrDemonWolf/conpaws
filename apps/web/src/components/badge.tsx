"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

import { BadgeCard } from "./badge-card";

const BadgePhysics = dynamic(() => import("./badge-physics"), { ssr: false });

/**
 * Chooses between the static badge and the draggable physics lanyard.
 *
 * Physics requires: a fine pointer (mouse/trackpad — Rapier drag on touch
 * fights scrolling), no reduced-motion preference, and a viewport wide enough
 * for the swing room. Even then the ~1.5MB three+Rapier chunk only starts
 * loading after the browser goes idle, and the static badge is what paints
 * first — so the page is never waiting on WebGL.
 *
 * The whole thing is decorative: aria-hidden here, and the form remains the
 * only accessible control. The name is a visual echo of form state.
 */
export function Badge({ name }: { name: string }) {
  const [physics, setPhysics] = useState(false);

  useEffect(() => {
    const capable =
      window.matchMedia("(prefers-reduced-motion: no-preference)").matches &&
      window.matchMedia("(pointer: fine)").matches &&
      window.matchMedia("(min-width: 768px)").matches;
    if (!capable) return;

    let idleId: number | undefined;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    if ("requestIdleCallback" in window) {
      idleId = window.requestIdleCallback(() => setPhysics(true));
    } else {
      timeoutId = setTimeout(() => setPhysics(true), 1500);
    }
    return () => {
      if (idleId !== undefined) window.cancelIdleCallback(idleId);
      if (timeoutId !== undefined) clearTimeout(timeoutId);
    };
  }, []);

  return (
    <div aria-hidden="true">
      {physics ? (
        <BadgePhysics name={name} onFailed={() => setPhysics(false)} />
      ) : (
        <BadgeCard name={name} />
      )}
      <p className="mt-4 text-center font-tech text-[11px] text-muted-foreground uppercase tracking-[0.2em]">
        {physics
          ? "↑ grab the badge — and type your name"
          : "↑ your badge fills in as you type"}
      </p>
    </div>
  );
}
