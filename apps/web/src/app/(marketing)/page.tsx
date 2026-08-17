import { CompassPaw } from "@/components/compass-paw";
import { Waitlist } from "@/components/waitlist";

/**
 * Features styled as a convention schedule — the product is a schedule app,
 * so the pitch reads like one. Times are a joke that lands at 23:59.
 */
const LINEUP = [
  {
    time: "10:00",
    title: "Import any schedule",
    body: "Drop in an .ics file or paste a Sched link. Re-import later without losing what you've picked.",
    tag: "Core",
    room: "Main Hall",
  },
  {
    time: "13:30",
    title: "Smart reminders",
    body: "Nudges before the panels you actually starred. Nothing else, ever.",
    tag: "QoL",
    room: "Panel Room 2",
  },
  {
    time: "16:00",
    title: "Content flags",
    body: "18+ and photosensitivity warnings surfaced automatically from the schedule.",
    tag: "Safety",
    room: "Ops",
  },
  {
    time: "23:59",
    title: "Works offline",
    body: "Everything lives on your phone. Con WiFi dying at peak hours is someone else's problem now.",
    tag: "Core",
    room: "Everywhere",
  },
] as const;

const STEPS = [
  {
    n: "01",
    title: "Download",
    body: "Free on iOS and Android at launch.",
  },
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

const TICKER_ITEMS = [
  "Schedules",
  "Offline first",
  "Reminders",
  "Content flags",
  "iOS",
  "Android",
  "Open source",
] as const;

function Ticker() {
  const row = TICKER_ITEMS.map((item) => (
    <span key={item} className="flex items-center gap-6 pr-6">
      <span className="font-bold text-[15px] text-transparent uppercase tracking-[0.2em] [-webkit-text-stroke:1px_rgb(148_163_184/0.5)]">
        {item}
      </span>
      <CompassPaw className="h-3.5 w-3.5 shrink-0 text-primary/50" />
    </span>
  ));

  return (
    <div className="relative mt-28 overflow-hidden border-border border-y py-5">
      <p className="sr-only">
        Schedules, offline first, reminders, content flags, iOS, Android, open
        source.
      </p>
      <div
        aria-hidden="true"
        className="motion-safe:animate-marquee flex w-max"
      >
        <div className="flex">{row}</div>
        <div className="flex">{row}</div>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <main className="relative mx-auto max-w-[1120px] px-6 pb-28">
      <nav className="flex items-center justify-between py-7">
        <span className="flex items-center gap-2.5">
          <CompassPaw className="h-7 w-7 text-primary" />
          <b className="font-bold text-[18px] tracking-tight">ConPaws</b>
        </span>
        <span className="rounded-full border border-border px-3 py-1 font-tech text-[10px] text-muted-foreground uppercase tracking-[0.2em]">
          Coming soon
        </span>
      </nav>

      <section className="pt-6">
        <Waitlist />
      </section>

      <Ticker />

      <section className="mt-24">
        <div className="flex items-baseline justify-between">
          <h2 className="font-tech text-[11px] text-primary uppercase tracking-[0.3em]">
            Today&rsquo;s lineup
          </h2>
          <span className="font-tech text-[10px] text-muted-foreground uppercase tracking-[0.2em]">
            Day 1 of ∞
          </span>
        </div>

        <div className="mt-6 overflow-hidden rounded-2xl border border-border">
          {LINEUP.map((item, i) => (
            <div
              key={item.title}
              className={`group grid grid-cols-[64px_1fr] items-start gap-x-5 bg-card/40 px-5 py-5 transition hover:bg-card sm:grid-cols-[80px_1fr_auto] sm:px-7 ${
                i > 0 ? "border-border border-t" : ""
              }`}
            >
              <span className="pt-0.5 font-tech text-[15px] text-primary tracking-[0.06em]">
                {item.time}
              </span>
              <div>
                <h3 className="font-bold text-[17px] tracking-tight transition group-hover:text-primary">
                  {item.title}
                </h3>
                <p className="mt-1 max-w-[52ch] text-[13.5px] text-muted-foreground leading-relaxed">
                  {item.body}
                </p>
              </div>
              <div className="col-start-2 mt-2 flex gap-2 sm:col-start-3 sm:mt-0 sm:flex-col sm:items-end">
                <span className="rounded-[6px] border border-primary/30 bg-primary/10 px-2 py-0.5 font-tech text-[9px] text-primary uppercase tracking-[0.18em]">
                  {item.tag}
                </span>
                <span className="pt-0.5 font-tech text-[9px] text-muted-foreground uppercase tracking-[0.18em]">
                  {item.room}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-24">
        <h2 className="font-tech text-[11px] text-primary uppercase tracking-[0.3em]">
          How it works
        </h2>
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {STEPS.map((step) => (
            <div
              key={step.n}
              className="group rounded-2xl border border-border bg-card/40 p-6 transition hover:-translate-y-1 hover:border-primary/60 hover:bg-card"
            >
              <span className="font-bold text-[38px] text-transparent leading-none [-webkit-text-stroke:1.5px_rgb(15_172_237/0.55)] transition group-hover:text-primary group-hover:[-webkit-text-stroke:0px]">
                {step.n}
              </span>
              <h3 className="mt-4 font-bold text-[16px] tracking-tight">
                {step.title}
              </h3>
              <p className="mt-1.5 text-[13px] text-muted-foreground leading-relaxed">
                {step.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      <footer className="relative mt-28 overflow-hidden border-border border-t pt-10">
        <p
          aria-hidden="true"
          className="pointer-events-none absolute right-0 bottom-[-30px] select-none font-bold text-[120px] text-transparent leading-none tracking-tighter [-webkit-text-stroke:1px_rgb(30_58_95/0.8)] sm:text-[170px]"
        >
          ConPaws
        </p>
        <div className="relative flex flex-wrap items-end justify-between gap-6 pb-8">
          <div>
            <span className="flex items-center gap-2">
              <CompassPaw className="h-5 w-5 text-primary" />
              <b className="text-[15px] tracking-tight">ConPaws</b>
            </span>
            <p className="mt-2 font-tech text-[10px] text-muted-foreground uppercase tracking-[0.18em]">
              © {new Date().getFullYear()} ConPaws by MrDemonWolf, Inc. · Made
              with paws
            </p>
          </div>
          <nav className="flex gap-5 font-tech text-[11px] text-muted-foreground uppercase tracking-[0.18em]">
            <a href="/privacy" className="transition hover:text-primary">
              Privacy
            </a>
            <a href="/terms" className="transition hover:text-primary">
              Terms
            </a>
          </nav>
        </div>
      </footer>
    </main>
  );
}
