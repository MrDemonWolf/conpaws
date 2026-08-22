"use client";

import { useEffect, useRef, useState } from "react";

import { BadgeFace } from "./badge-face";

/**
 * The badge number this settles on.
 *
 * 0001 is deliberate and literal: the person looking at the page is the
 * founding badge. It is NOT a signup count — the waitlist is closed, and a
 * page that appeared to tick upward with real registrations would be claiming
 * something untrue. When signups open, this becomes the reader's confirmed
 * waitlist position (CON-28 only allows showing that after confirmation).
 */
const BADGE_NUMBER = 1;
const BADGE_DIGITS = 4;
/** How long the digits spin before they have all landed. */
const ROLL_MS = 900;

/**
 * Static badge assembly: fabric straps, metal clip, CSS sway, pointer tilt,
 * and the badge number rolling into place on first paint.
 *
 * Entirely decorative — `aria-hidden` is applied by the <Badge> wrapper. The
 * name is a visual echo of form state, never its source.
 */
export function BadgeCard({ name }: { name: string }) {
  const cardRef = useRef<HTMLDivElement>(null);
  const frame = useRef<number>(0);
  const [motionOk, setMotionOk] = useState(false);

  const settled = String(BADGE_NUMBER).padStart(BADGE_DIGITS, "0");
  const [badgeNumber, setBadgeNumber] = useState(settled);

  useEffect(() => {
    setMotionOk(!window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);

  // Digits climb 0-9 and land left to right, like a printer stamping the
  // badge. Deterministic rather than random so it reads as counting up
  // instead of scrambling. Skipped entirely under reduced motion — the number
  // is simply correct from the first frame.
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let raf = 0;
    let start: number | undefined;

    const step = (now: number) => {
      start ??= now;
      const elapsed = now - start;
      const progress = Math.min(1, elapsed / ROLL_MS);

      setBadgeNumber(
        settled
          .split("")
          .map((digit, index) => {
            const landsAt = 0.3 + index * 0.17;
            if (progress >= landsAt) return digit;
            return String(Math.floor(elapsed / 60 + index * 3) % 10);
          })
          .join(""),
      );

      if (progress < 1) raf = requestAnimationFrame(step);
    };

    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [settled]);

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!motionOk || !cardRef.current) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const dx = (event.clientX - rect.left) / rect.width - 0.5;
    const dy = (event.clientY - rect.top) / rect.height - 0.5;
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      if (cardRef.current) {
        cardRef.current.style.transform = `rotateY(${dx * 14}deg) rotateX(${dy * -12}deg)`;
      }
    });
  }

  function onPointerLeave() {
    cancelAnimationFrame(frame.current);
    if (cardRef.current) {
      cardRef.current.style.transform = "rotateY(0deg) rotateX(0deg)";
    }
  }

  return (
    <div
      className="group/badge flex select-none flex-col items-center"
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
    >
      {/* Everything below sways together, hinged where the clip sits. */}
      <div className="motion-safe:animate-sway flex origin-[50%_-30px] flex-col items-center">
        {/* ---- lanyard straps ----
            Anchored at the BOTTOM and much taller than their visible area, so
            their top ends always sit above the viewport edge — a strap that
            visibly ends mid-air reads as a rendering bug (and did, on mobile).
            The container height is what tunes how much lanyard shows. */}
        {/* pointer-events-none: the straps are 560px tall and deliberately run
            up past the top of the hero, over the nav. They are decoration, so
            they must not sit in front of anything and swallow its clicks. */}
        {/* z-10 lifts the straps and clip above the card below. The card
            wrapper opens its own stacking context via `perspective`, so
            without this the clip can never overlap the badge and the lanyard
            reads as floating above a card it isn't attached to. */}
        <div className="pointer-events-none relative z-10 h-[110px] w-[300px] md:h-[150px]">
          {/* Both straps pivot from the SAME point — the centre, just under the
              ring — so they meet at the clip and splay upward in a V, the way
              a real lanyard does. They used to hang from left-[52px] and
              right-[52px], which left them running past the clip on either
              side instead of joining it. `origin-bottom` is what makes the
              shared pivot work: the bottom edge stays put and only the top
              swings out. */}
          <div className="strap-fabric -translate-x-1/2 -rotate-[13deg] absolute bottom-[16px] left-1/2 flex h-[560px] w-[26px] origin-bottom items-center justify-center overflow-hidden rounded-[3px]">
            <span className="whitespace-nowrap font-tech text-[7px] text-primary/50 uppercase tracking-[0.35em] [writing-mode:vertical-rl]">
              CONPAWS ✦ CONPAWS ✦ CONPAWS ✦ CONPAWS ✦ CONPAWS ✦ CONPAWS ✦
              CONPAWS ✦ CONPAWS ✦ CONPAWS ✦ CONPAWS ✦ CONPAWS ✦ CONPAWS
            </span>
          </div>
          <div className="strap-fabric -translate-x-1/2 absolute bottom-[16px] left-1/2 flex h-[560px] w-[26px] origin-bottom rotate-[13deg] items-center justify-center overflow-hidden rounded-[3px]">
            <span className="whitespace-nowrap font-tech text-[7px] text-primary/50 uppercase tracking-[0.35em] [writing-mode:vertical-rl]">
              ✦ CONPAWS ✦ CONPAWS ✦ CONPAWS ✦ CONPAWS ✦ CONPAWS ✦ CONPAWS ✦
              CONPAWS ✦ CONPAWS ✦ CONPAWS ✦ CONPAWS ✦ CONPAWS ✦
            </span>
          </div>

          {/* Metal ring + clip where the straps meet.
              The clip hangs BELOW the container so its jaw covers the punched
              slot on the card face (which sits at top-[12px], 10px tall). The
              ring stays above the card; only the clip crosses onto it, which
              is what sells "threaded through the slot" rather than "resting
              on top of". */}
          <div className="-translate-x-1/2 absolute bottom-[-18px] left-1/2 flex flex-col items-center">
            <div className="h-[16px] w-[16px] rounded-full border-[2.5px] border-slate-400/80 bg-transparent shadow-[0_1px_3px_rgb(0_0_0/0.5)]" />
            <div className="-mt-[2px] h-[34px] w-[30px] rounded-[4px] border border-slate-500/60 bg-gradient-to-b from-slate-300 via-slate-400 to-slate-500 shadow-[inset_0_1px_1px_rgb(255_255_255/0.5),0_3px_6px_rgb(0_0_0/0.55)]">
              <div className="mx-auto mt-[8px] h-[3px] w-[14px] rounded-full bg-slate-600/70" />
            </div>
          </div>
        </div>

        {/* ---- the card, with pointer tilt ---- */}
        <div className="[perspective:1100px]">
          <div ref={cardRef} className="badge-tilt">
            <BadgeFace name={name} badgeNumber={badgeNumber} />
          </div>
        </div>
      </div>
    </div>
  );
}
