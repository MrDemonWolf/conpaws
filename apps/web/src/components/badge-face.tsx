import { CompassPaw } from "./compass-paw";

/** Deterministic 11×11 mini-QR. Pure decoration — encodes nothing. */
const QR = [
  "11111010111",
  "10001001001",
  "10101010101",
  "10001011101",
  "11111010111",
  "00000100000",
  "11101110111",
  "01010001010",
  "11011010011",
  "10110101101",
  "11101011111",
].map((row) => row.split("").map((c) => c === "1"));

/**
 * The badge card face. Pure presentation, no handlers.
 * Fixed size: 320 × ~470px. The punch slot centre sits at (160, 17).
 *
 * `badgeNumber` arrives pre-formatted (four characters) so the roll-in
 * animation lives with the state that drives it, in badge-card.
 */
export function BadgeFace({
  name,
  badgeNumber = "0001",
}: {
  name: string;
  badgeNumber?: string;
}) {
  const filled = name.trim().length > 0;

  return (
    <div className="relative w-[320px] overflow-hidden rounded-[20px] border border-border bg-gradient-to-b from-[#13234f] via-card to-[#0b1839] shadow-[0_50px_90px_-30px_rgb(0_0_0/0.85),inset_0_1px_0_rgb(255_255_255/0.07)]">
      {/* punched slot the ring passes through */}
      <div className="-translate-x-1/2 absolute top-[12px] left-1/2 h-[10px] w-[76px] rounded-full bg-background shadow-[inset_0_2px_4px_rgb(0_0_0/0.9),0_1px_0_rgb(255_255_255/0.06)]" />

      {/* ghost paw watermark */}
      <CompassPaw className="-right-12 -bottom-12 absolute h-[220px] w-[220px] rotate-12 text-primary opacity-[0.05]" />

      {/* shine sweep on hover */}
      <div className="badge-shine-layer" />

      <div className="relative px-6 pt-9 pb-6">
        {/* header */}
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <CompassPaw className="h-6 w-6 text-primary" />
            <span className="font-bold text-[15px] tracking-tight">
              ConPaws
            </span>
          </span>
          <span className="rounded-[6px] border border-primary/40 bg-primary/10 px-2 py-0.5 font-tech text-[9px] text-primary uppercase tracking-[0.22em]">
            Beta
          </span>
        </div>

        {/* holographic foil strip */}
        <div
          className="motion-safe:animate-holo mt-4 h-[7px] rounded-full opacity-80"
          style={{
            background:
              "linear-gradient(110deg,#0faced,#7dd3fc,#a78bfa,#34d399,#facc15,#0faced)",
            backgroundSize: "300% 100%",
          }}
        />

        {/* name zone */}
        <div className="mt-5 min-h-[92px]">
          <p className="font-tech text-[9px] text-muted-foreground uppercase tracking-[0.3em]">
            Attendee · Fursona
          </p>
          <p
            className={`mt-1 border-border border-b-2 border-dashed pb-2 font-hand text-[42px] leading-[1.1] ${
              filled ? "text-sky-300" : "text-muted-foreground/40"
            }`}
          >
            {filled ? name : "your name here"}
          </p>
        </div>

        {/* role band */}
        <div className="mt-4 flex items-center justify-between rounded-[8px] bg-primary px-3.5 py-2">
          <span className="font-bold text-[12px] text-primary-foreground uppercase tracking-[0.18em]">
            Beta Tester
          </span>
          <span className="font-tech text-[9px] text-primary-foreground/80 uppercase tracking-[0.14em]">
            Founding Pack
          </span>
        </div>

        {/* footer: QR + badge number */}
        <div className="mt-5 flex items-end justify-between">
          <svg
            viewBox="0 0 11 11"
            className="h-[52px] w-[52px] rounded-[4px] bg-slate-100 p-[3px]"
            role="presentation"
          >
            <title>Badge code</title>
            {QR.flatMap((row, y) =>
              row.map((on, x) =>
                on ? (
                  <rect
                    // biome-ignore lint/suspicious/noArrayIndexKey: static grid
                    key={`${x}-${y}`}
                    x={x + 0.55}
                    y={y + 0.55}
                    width={0.9}
                    height={0.9}
                    fill="#0b1839"
                    transform="scale(0.909)"
                  />
                ) : null,
              ),
            )}
          </svg>
          <div className="text-right">
            <p className="font-tech text-[22px] text-primary leading-none tracking-[0.08em] tabular-nums">
              № {badgeNumber}
            </p>
            <p className="mt-1.5 font-tech text-[8.5px] text-muted-foreground uppercase tracking-[0.24em]">
              iOS · Android · Est. 2026
            </p>
            <p className="mt-0.5 font-tech text-[8.5px] text-muted-foreground/70 uppercase tracking-[0.24em]">
              Navigate · Connect · Enjoy
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
