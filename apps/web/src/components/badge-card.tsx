"use client";

import { useEffect, useRef, useState } from "react";

import { BadgeFace } from "./badge-face";

/**
 * Static badge assembly: fabric straps, metal clip, CSS sway, pointer tilt.
 *
 * This is the fallback and first paint. The draggable Rapier version
 * (badge-physics) replaces it on capable devices once it has lazy-loaded.
 *
 * Entirely decorative — `aria-hidden` is applied by the <Badge> wrapper. The
 * name is a visual echo of form state, never its source.
 */
export function BadgeCard({ name }: { name: string }) {
  const cardRef = useRef<HTMLDivElement>(null);
  const frame = useRef<number>(0);
  const [motionOk, setMotionOk] = useState(false);

  useEffect(() => {
    setMotionOk(!window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);

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
        {/* ---- lanyard straps ---- */}
        <div className="relative h-[150px] w-[300px]">
          <div className="strap-fabric -rotate-[15deg] absolute top-[-34px] left-[46px] flex h-[190px] w-[26px] origin-bottom items-center justify-center overflow-hidden rounded-[3px]">
            <span className="whitespace-nowrap font-tech text-[7px] text-primary/50 uppercase tracking-[0.35em] [writing-mode:vertical-rl]">
              CONPAWS ✦ CONPAWS ✦ CONPAWS ✦ CONPAWS
            </span>
          </div>
          <div className="strap-fabric absolute top-[-34px] right-[46px] flex h-[190px] w-[26px] origin-bottom rotate-[15deg] items-center justify-center overflow-hidden rounded-[3px]">
            <span className="whitespace-nowrap font-tech text-[7px] text-primary/50 uppercase tracking-[0.35em] [writing-mode:vertical-rl]">
              ✦ CONPAWS ✦ CONPAWS ✦ CONPAWS ✦
            </span>
          </div>

          {/* metal ring + clip where the straps meet */}
          <div className="-translate-x-1/2 absolute bottom-[6px] left-1/2 flex flex-col items-center">
            <div className="h-[16px] w-[16px] rounded-full border-[2.5px] border-slate-400/80 bg-transparent shadow-[0_1px_3px_rgb(0_0_0/0.5)]" />
            <div className="-mt-[2px] h-[20px] w-[30px] rounded-[4px] border border-slate-500/60 bg-gradient-to-b from-slate-300 via-slate-400 to-slate-500 shadow-[inset_0_1px_1px_rgb(255_255_255/0.5),0_2px_4px_rgb(0_0_0/0.4)]">
              <div className="mx-auto mt-[7px] h-[3px] w-[14px] rounded-full bg-slate-600/70" />
            </div>
          </div>
        </div>

        {/* ---- the card, with pointer tilt ---- */}
        <div className="[perspective:1100px]">
          <div ref={cardRef} className="badge-tilt">
            <BadgeFace name={name} />
          </div>
        </div>
      </div>
    </div>
  );
}
