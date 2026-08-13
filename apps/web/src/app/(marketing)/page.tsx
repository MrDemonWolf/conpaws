import { CompassPaw } from "@/components/compass-paw";
import { Waitlist } from "@/components/waitlist";

const FEATURES = [
  {
    title: "Import any schedule",
    body: "Drop in an .ics file or paste a Sched link. Re-import later without losing what you've picked.",
  },
  {
    title: "Works offline",
    body: "Everything lives on your phone. No signal in the dealers den? Doesn't matter.",
  },
  {
    title: "Nudges, not spam",
    body: "Reminders before the panels you actually starred. Nothing else.",
  },
  {
    title: "Flags that matter",
    body: "18+ and photosensitivity warnings surfaced automatically from the schedule.",
  },
] as const;

const STEPS = [
  { n: "01", title: "Download", body: "Free on iOS and Android at launch." },
  {
    n: "02",
    title: "Pick your convention",
    body: "Import its schedule, or start one from scratch.",
  },
  {
    n: "03",
    title: "Build your weekend",
    body: "Star what you want. Get nudged before it starts.",
  },
] as const;

export default function Home() {
  return (
    <main className="relative mx-auto max-w-[1080px] px-6 pb-24">
      <nav className="flex items-center justify-between py-7">
        <span className="flex items-center gap-2.5">
          <CompassPaw className="h-6 w-6 text-primary" />
          <b className="font-bold text-[17px] tracking-tight">ConPaws</b>
        </span>
        <span className="text-[11px] text-muted-foreground uppercase tracking-[0.16em]">
          Coming soon
        </span>
      </nav>

      <section className="pt-8 pb-4">
        <Waitlist />
      </section>

      <section className="mt-24">
        <h2 className="mb-5 text-[11px] text-primary uppercase tracking-[0.24em]">
          What you get
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="rounded-2xl border border-border bg-card p-5 transition hover:-translate-y-0.5 hover:border-primary"
            >
              <h3 className="font-semibold text-[15px] tracking-tight">
                {f.title}
              </h3>
              <p className="mt-2 text-[12.5px] text-muted-foreground leading-relaxed">
                {f.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-20">
        <h2 className="mb-5 text-[11px] text-primary uppercase tracking-[0.24em]">
          How it works
        </h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {STEPS.map((s) => (
            <div
              key={s.n}
              className="rounded-2xl border border-border bg-card p-5"
            >
              <span className="font-bold text-[11px] text-primary tracking-[0.2em]">
                {s.n}
              </span>
              <h3 className="mt-2 font-semibold text-[15px] tracking-tight">
                {s.title}
              </h3>
              <p className="mt-1.5 text-[12.5px] text-muted-foreground leading-relaxed">
                {s.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      <footer className="mt-24 flex flex-wrap justify-between gap-3 border-border border-t pt-6 text-[11px] text-muted-foreground uppercase tracking-[0.14em]">
        <span>
          © {new Date().getFullYear()} ConPaws · Made with paws by MrDemonWolf,
          Inc.
        </span>
        <span className="flex gap-4">
          <a href="/privacy" className="hover:text-primary">
            Privacy
          </a>
          <a href="/terms" className="hover:text-primary">
            Terms
          </a>
        </span>
      </footer>
    </main>
  );
}
