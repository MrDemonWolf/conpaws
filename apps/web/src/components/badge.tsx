import { BadgeCard } from "./badge-card";

/**
 * The decorative con badge beside the waitlist form.
 *
 * There used to be a second, draggable version of this built on Rapier: a
 * physics lanyard you could swing. It was removed deliberately. It shipped
 * ~1.5MB of three + wasm for decoration, it needed a 720px invisible
 * container that fought the nav for stacking order and swallowed clicks
 * around it, and it forced `'wasm-unsafe-eval'` into the site's CSP. The
 * static badge is what every other page already used, and it is the one that
 * looked right.
 *
 * Entirely decorative: `aria-hidden` here, and the form remains the only
 * accessible control. The name is a visual echo of form state, never its
 * source.
 */
export function Badge({ name }: { name: string }) {
  return (
    <div aria-hidden="true">
      <BadgeCard name={name} />
      <p className="mt-4 text-center font-tech text-[11px] text-muted-foreground uppercase tracking-[0.2em]">
        ↑ your badge fills in as you type
      </p>
    </div>
  );
}
