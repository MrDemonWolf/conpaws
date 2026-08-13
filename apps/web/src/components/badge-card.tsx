import { CompassPaw } from "./compass-paw";

/**
 * The convention badge on its lanyard.
 *
 * Entirely decorative — `aria-hidden`. The name shown here is a visual echo of
 * what the visitor typed into the real form; the form is the source of truth
 * and the only thing a screen reader or keyboard user interacts with.
 *
 * This is the static version. The draggable physics lanyard (CON-27) will be
 * lazy-loaded on top of it with `next/dynamic({ ssr: false })`, so this stays
 * the first paint and the reduced-motion / low-end-device fallback.
 */
export function BadgeCard({ name }: { name: string }) {
  const filled = name.trim().length > 0;

  return (
    <div className="flex flex-col items-center" aria-hidden="true">
      {/* lanyard */}
      <svg
        width="190"
        height="76"
        viewBox="0 0 190 76"
        fill="none"
        className="-mb-1.5"
        role="presentation"
      >
        <title>Lanyard</title>
        <path
          d="M95 76 L70 16 Q69 6 79 5 L111 5 Q121 6 120 16 Z"
          fill="var(--card)"
          stroke="var(--border)"
        />
        <path d="M95 76 L82 18" stroke="var(--primary)" strokeOpacity=".42" />
        <path d="M95 76 L108 18" stroke="var(--primary)" strokeOpacity=".16" />
        <rect
          x="78"
          y="3"
          width="34"
          height="9"
          rx="4.5"
          fill="var(--secondary)"
          stroke="var(--border)"
        />
      </svg>

      <div className="badge-sway relative w-[300px] overflow-hidden rounded-[18px] border border-border bg-gradient-to-br from-secondary to-card px-[22px] pt-[26px] pb-[22px] shadow-[0_40px_70px_-34px_#000]">
        {/* punch hole */}
        <span className="-translate-x-1/2 absolute top-3 left-1/2 h-2.5 w-[72px] rounded-full bg-background shadow-[inset_0_1px_3px_#000]" />
        {/* foil sheen */}
        <span className="pointer-events-none absolute inset-0 bg-[linear-gradient(115deg,transparent_34%,rgba(15,172,237,0.16)_47%,rgba(255,255,255,0.10)_52%,transparent_64%)]" />

        <p className="mx-auto mt-4 w-fit rounded-full bg-primary px-3 py-1 font-bold text-[9.5px] text-primary-foreground uppercase tracking-[0.26em]">
          Beta Tester
        </p>

        <CompassPaw className="mx-auto my-3 h-[72px] w-[72px] text-primary" />

        <p
          className={`mx-1.5 min-h-7 border-border border-b border-dashed pb-2.5 text-center font-bold text-[21px] tracking-tight ${
            filled ? "text-foreground" : "text-muted-foreground/60"
          }`}
        >
          {filled ? name : "Your name here"}
        </p>

        <p className="mt-2.5 text-center text-[10px] text-muted-foreground uppercase tracking-[0.2em]">
          Navigate · Connect · Enjoy
        </p>

        <div className="mt-4 flex justify-between border-border border-t pt-3 text-[9.5px] text-muted-foreground uppercase tracking-[0.14em]">
          <span>ConPaws</span>
          <span>
            No. <span className="font-semibold text-primary">0007</span>
          </span>
        </div>
      </div>

      <p className="mt-5 text-center text-[11px] text-muted-foreground uppercase tracking-[0.16em]">
        ↑ your badge fills in as you type
      </p>
    </div>
  );
}
