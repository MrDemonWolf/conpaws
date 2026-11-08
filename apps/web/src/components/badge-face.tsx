import { limitBadgeName } from "./badge-name";
import { CompassPaw } from "./compass-paw";

/**
 * The badge card face. Pure presentation, no handlers.
 * Portrait 3:4 proportions, 288 × 384 CSS pixels at the preferred size.
 * This is an on-screen reference size, not a physically calibrated print.
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
  const badgeName = limitBadgeName(name);
  const filled = badgeName.trim().length > 0;

  return (
    <div className="relative aspect-[3/4] w-full max-w-[288px] overflow-hidden rounded-[20px] border border-border bg-gradient-to-b from-secondary via-card to-background shadow-[0_50px_90px_-30px_rgb(0_0_0/0.85),inset_0_1px_0_rgb(255_255_255/0.07)]">
      {/* punched slot the ring passes through */}
      <div className="-translate-x-1/2 absolute top-[12px] left-1/2 h-[10px] w-[76px] rounded-full bg-background shadow-[inset_0_2px_4px_rgb(0_0_0/0.9),0_1px_0_rgb(255_255_255/0.06)]" />

      {/* shine sweep on hover */}
      <div className="badge-shine-layer" />

      <div className="relative flex h-full flex-col px-5 pt-9 pb-5">
        {/* header */}
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <CompassPaw className="h-6 w-6 text-primary" />
            <span className="font-display font-bold text-[15px] tracking-tight">
              ConPaws
            </span>
          </span>
          <span className="rounded-[6px] border border-primary/40 bg-primary/10 px-2 py-0.5 font-tech font-medium text-[9.5px] text-primary uppercase tracking-[0.14em]">
            Beta
          </span>
        </div>

        {/* holographic foil strip */}
        <div
          className="motion-safe:animate-holo mt-4 h-[7px] rounded-full opacity-80"
          style={{
            background: "linear-gradient(110deg,#0faced,#9be3fb,#0faced)",
            backgroundSize: "300% 100%",
          }}
        />

        {/* name zone */}
        <div className="mt-5 min-h-[92px] flex-1">
          <p className="font-tech font-medium text-[10px] text-muted-foreground uppercase tracking-[0.18em]">
            Attendee · Fursona
          </p>
          {/* Printed, not handwritten. This was Caveat at 42px, which is what
              a real badge's write-in line looks like and also what an unfamiliar
              name is hardest to read in — and the whole point of the field is
              that you recognise your own name in it. The dashed rule below
              still carries the write-on-a-badge idea. `break-words` because the
              name is free text from the form and Montserrat is far wider than
              Caveat was, so it runs out of card sooner. */}
          <p
            className={`mt-1 break-words border-border border-b-2 border-dashed pb-2 font-display font-semibold leading-[1.15] tracking-[-0.01em] ${badgeName.length > 21 ? "text-[24px]" : "text-[30px]"} ${
              filled ? "text-primary" : "text-muted-foreground"
            }`}
          >
            {filled ? badgeName : "your name here"}
          </p>
        </div>

        {/* membership mark */}
        <div className="mt-4 rounded-[8px] border border-primary/20 bg-primary/8 px-3.5 py-2.5">
          <div className="border-primary border-l-2 pl-3">
            <p className="font-display font-bold text-[12px] text-foreground uppercase tracking-[0.12em]">
              Beta Tester
            </p>
            <p className="mt-0.5 font-tech font-medium text-[9px] text-primary uppercase tracking-[0.12em]">
              Founding Pack
            </p>
          </div>
        </div>

        {/* footer: real brand mark and readable badge number */}
        <div className="mt-auto flex items-end justify-between border-border border-t pt-3.5">
          <div className="flex items-center gap-2.5">
            <div className="grid h-10 w-10 place-items-center rounded-[9px] border border-primary/20 bg-primary/8">
              <CompassPaw className="h-6 w-6 text-primary" />
            </div>
            <p className="font-tech font-medium text-[9px] text-muted-foreground uppercase tracking-[0.1em]">
              Offline ready
            </p>
          </div>
          <div className="text-right">
            <p className="font-tech font-medium text-[8px] text-muted-foreground uppercase tracking-[0.16em]">
              Badge no.
            </p>
            <p className="mt-1 font-tech font-semibold text-[22px] text-primary leading-none tracking-[0.04em] tabular-nums">
              {badgeNumber}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
