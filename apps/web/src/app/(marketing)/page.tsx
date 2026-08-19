import { CompassPaw } from "@/components/compass-paw";
import { Waitlist } from "@/components/waitlist";

/**
 * The pre-release landing page, styled as a convention program guide — the
 * product is a schedule app, so the whole page reads like one. Everything
 * here is launch-stable: at go-live only copy changes (the waitlist flag,
 * store links when they exist), never structure.
 *
 * The "screenshots" are DOM mockups of the app UI drawn with the same brand
 * tokens. When real captures exist, each <PhoneFrame> body is swapped for an
 * <Image> without touching the layout around it.
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
    body: "Nudges before the events you choose. Nothing else, ever.",
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

const STATS = [
  { value: "100%", label: "of features work offline" },
  { value: "0", label: "accounts needed to use it" },
  { value: "1 link", label: "imports a whole schedule" },
  { value: "∞", label: "conventions in one app" },
] as const;

const FAQ = [
  {
    q: "Is it free?",
    a: "Yes. The schedule, imports, reminders, and offline mode are free. A ConPaws+ upgrade with extras is planned later — nothing you see here moves behind it.",
  },
  {
    q: "Do I need an account?",
    a: "No. ConPaws works entirely without one. Your schedule lives on your phone, not on our servers.",
  },
  {
    q: "What if the con WiFi dies?",
    a: "Nothing happens. ConPaws is offline-first: every feature keeps working with zero bars in a basement dealers' den.",
  },
  {
    q: "Which conventions does it work with?",
    a: "Any that publish an .ics calendar or a Sched page — which covers most furry cons. You can also build a schedule by hand for the ones that don't.",
  },
  {
    q: "When does it launch?",
    a: "The beta opens to the waitlist first, iOS and Android together. Join above and you'll get one email when your invite is ready.",
  },
  {
    q: "Who makes it?",
    a: "ConPaws is built by MrDemonWolf, Inc. — con-goers building the app we wished we had in the hallway line.",
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
      <span className="font-bold text-[15px] text-transparent uppercase tracking-[0.2em] [-webkit-text-stroke:1px_rgb(148_163_184/0.75)]">
        {item}
      </span>
      <CompassPaw className="h-3.5 w-3.5 shrink-0 text-primary/50" />
    </span>
  ));

  return (
    <div className="relative z-10 mt-28 overflow-hidden border-border border-y bg-background/80 py-5">
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

function SectionHeading({
  eyebrow,
  title,
  blurb,
}: {
  eyebrow: string;
  title: string;
  blurb?: string;
}) {
  return (
    <div className="max-w-[560px]">
      <p className="font-tech text-[12px] text-primary uppercase tracking-[0.3em]">
        {eyebrow}
      </p>
      <h2 className="mt-3 text-balance font-bold text-[clamp(28px,4vw,40px)] leading-[1.05] tracking-[-0.02em]">
        {title}
      </h2>
      {blurb ? (
        <p className="mt-4 text-[15px] text-muted-foreground leading-relaxed">
          {blurb}
        </p>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------------ */
/* Phone mockups — DOM-drawn app screens, swappable for real captures later */
/* ------------------------------------------------------------------------ */

function PhoneFrame({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <figure className={`w-[248px] shrink-0 ${className}`}>
      <div className="rounded-[36px] border border-border bg-gradient-to-b from-slate-700/60 to-slate-900/80 p-[7px] shadow-[0_40px_80px_-30px_rgb(0_0_0/0.8),inset_0_1px_0_rgb(255_255_255/0.08)]">
        <div className="relative overflow-hidden rounded-[29px] border border-border/60 bg-background">
          {/* speaker/camera pill */}
          <div className="-translate-x-1/2 absolute top-[9px] left-1/2 z-10 h-[18px] w-[74px] rounded-full bg-black/90" />
          {children}
        </div>
      </div>
      <figcaption className="mt-4 text-center font-tech text-[11px] text-muted-foreground uppercase tracking-[0.2em]">
        {label}
      </figcaption>
    </figure>
  );
}

function MiniEvent({
  time,
  title,
  room,
  starred,
  flag,
}: {
  time: string;
  title: string;
  room: string;
  starred?: boolean;
  flag?: string;
}) {
  return (
    <div
      className={`rounded-[10px] border px-3 py-2.5 ${
        starred ? "border-primary/50 bg-primary/10" : "border-border bg-card/60"
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="font-tech text-[10px] text-primary tracking-[0.08em]">
          {time}
        </span>
        <span aria-hidden="true" className="text-[11px] leading-none">
          {starred ? "★" : "☆"}
        </span>
      </div>
      <p className="mt-1 font-bold text-[12px] leading-tight tracking-tight">
        {title}
      </p>
      <div className="mt-1 flex items-center gap-2">
        <span className="font-tech text-[9px] text-muted-foreground uppercase tracking-[0.14em]">
          {room}
        </span>
        {flag ? (
          <span className="rounded-[4px] border border-amber-400/40 bg-amber-400/10 px-1 py-px font-tech text-[8px] text-amber-300 uppercase tracking-[0.1em]">
            {flag}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function ScreenChrome({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-[470px] flex-col px-3 pt-9 pb-3 text-foreground">
      {children}
    </div>
  );
}

function ScheduleScreen() {
  return (
    <ScreenChrome>
      <p className="font-tech text-[9px] text-muted-foreground uppercase tracking-[0.2em]">
        IndyFurCon 2026
      </p>
      <p className="mt-0.5 font-bold text-[16px] tracking-tight">My weekend</p>
      <div className="mt-2.5 flex gap-1.5">
        {["Fri", "Sat", "Sun"].map((d, i) => (
          <span
            key={d}
            className={`rounded-full px-2.5 py-1 font-tech text-[9px] uppercase tracking-[0.12em] ${
              i === 1
                ? "bg-primary font-bold text-primary-foreground"
                : "border border-border text-muted-foreground"
            }`}
          >
            {d}
          </span>
        ))}
      </div>
      <div className="mt-3 flex flex-col gap-2">
        <MiniEvent
          time="10:00"
          title="Fursuit Parade"
          room="Main Hall"
          starred
        />
        <MiniEvent time="11:30" title="Drawing for Beginners" room="Panel 2" />
        <MiniEvent time="13:00" title="Dealers' Den" room="Hall B" starred />
        <MiniEvent time="20:00" title="DJ Night" room="Ballroom" flag="18+" />
      </div>
      <div className="mt-auto flex items-center justify-around border-border border-t pt-2.5">
        {["Home", "Schedule", "Settings"].map((t, i) => (
          <span
            key={t}
            className={`font-tech text-[9px] uppercase tracking-[0.12em] ${
              i === 1 ? "text-primary" : "text-muted-foreground/70"
            }`}
          >
            {t}
          </span>
        ))}
      </div>
    </ScreenChrome>
  );
}

function EventScreen() {
  return (
    <ScreenChrome>
      <p className="font-tech text-[9px] text-muted-foreground uppercase tracking-[0.2em]">
        ← Saturday
      </p>
      <p className="mt-2 font-bold text-[19px] leading-tight tracking-tight">
        Fursuit Parade
      </p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <span className="rounded-[5px] bg-primary px-2 py-0.5 font-tech text-[9px] text-primary-foreground uppercase tracking-[0.1em]">
          10:00–11:00
        </span>
        <span className="rounded-[5px] border border-border px-2 py-0.5 font-tech text-[9px] text-muted-foreground uppercase tracking-[0.1em]">
          Main Hall
        </span>
      </div>
      <p className="mt-3 text-[11px] text-muted-foreground leading-relaxed">
        Line up on the mezzanine by 9:40. The route ends at the photo wall —
        stick around for the group shot.
      </p>
      <div className="mt-4 flex items-center justify-between rounded-[10px] border border-primary/40 bg-primary/10 px-3 py-2.5">
        <span className="font-bold text-[11px]">Remind me</span>
        <span className="flex h-[18px] w-[32px] items-center rounded-full bg-primary p-[2px]">
          <span className="ml-auto h-[14px] w-[14px] rounded-full bg-primary-foreground" />
        </span>
      </div>
      <p className="mt-2 font-tech text-[9px] text-muted-foreground uppercase tracking-[0.14em]">
        15 minutes before · on device
      </p>
      <div className="mt-auto rounded-[10px] bg-primary px-3 py-2.5 text-center font-bold text-[11px] text-primary-foreground uppercase tracking-[0.12em]">
        ★ On my schedule
      </div>
    </ScreenChrome>
  );
}

function OfflineScreen() {
  return (
    <ScreenChrome>
      <div className="rounded-[8px] border border-amber-400/40 bg-amber-400/10 px-2.5 py-1.5 font-tech text-[9px] text-amber-300 uppercase tracking-[0.12em]">
        No connection — everything still works
      </div>
      <p className="mt-3 font-bold text-[16px] tracking-tight">Up next</p>
      <div className="mt-2.5 flex flex-col gap-2">
        <MiniEvent time="13:00" title="Dealers' Den" room="Hall B" starred />
        <MiniEvent time="14:30" title="Writing Furry Fiction" room="Panel 1" />
      </div>
      <div className="mt-4 flex items-center gap-2 rounded-[10px] border border-border bg-card/60 px-3 py-2.5">
        <span aria-hidden="true" className="text-[13px] text-primary">
          ✓
        </span>
        <div>
          <p className="font-bold text-[11px] leading-tight">Saved on device</p>
          <p className="mt-0.5 font-tech text-[9px] text-muted-foreground uppercase tracking-[0.12em]">
            Schedule · picks · reminders
          </p>
        </div>
      </div>
      <div className="mt-auto flex items-center justify-around border-border border-t pt-2.5">
        {["Home", "Schedule", "Settings"].map((t, i) => (
          <span
            key={t}
            className={`font-tech text-[9px] uppercase tracking-[0.12em] ${
              i === 0 ? "text-primary" : "text-muted-foreground/70"
            }`}
          >
            {t}
          </span>
        ))}
      </div>
    </ScreenChrome>
  );
}

/* ------------------------------------------------------------------------ */

export default function Home() {
  return (
    <main className="relative mx-auto max-w-[1120px] px-6 pb-28">
      <nav className="relative z-20 flex items-center justify-between py-7">
        <span className="flex items-baseline gap-2.5">
          <span className="flex items-center gap-2.5">
            <CompassPaw className="h-7 w-7 text-primary" />
            <b className="font-bold text-[18px] tracking-tight">ConPaws</b>
          </span>
          <span className="hidden font-tech text-[10px] text-muted-foreground uppercase tracking-[0.18em] sm:inline">
            by MrDemonWolf,&nbsp;Inc.
          </span>
        </span>
        <span className="rounded-full border border-border px-3 py-1 font-tech text-[11px] text-muted-foreground uppercase tracking-[0.2em]">
          Coming soon
        </span>
      </nav>

      {/* The hero is z-0 so the decorative badge (and its lanyard, which runs
          to the top of the screen) can never paint over the nav or any section
          below — everything after this stacks above it. */}
      <section id="waitlist" className="relative z-0 pt-6">
        <Waitlist />
      </section>

      <Ticker />

      {/* ---- a look inside ---- */}
      <section className="relative z-10 mt-28">
        <SectionHeading
          eyebrow="A look inside"
          title="Your whole weekend, one thumb"
          blurb="Early builds, real screens. The schedule you build is the schedule you see — no feeds, no algorithm, no pull-to-refresh roulette."
        />
        <div className="mt-12 flex flex-wrap items-start justify-center gap-8 md:gap-6">
          <PhoneFrame
            label="Build your weekend"
            className="md:translate-y-8 md:rotate-[-4deg]"
          >
            <ScheduleScreen />
          </PhoneFrame>
          <PhoneFrame label="Never miss a lineup" className="z-10">
            <EventScreen />
          </PhoneFrame>
          <PhoneFrame
            label="WiFi optional"
            className="md:translate-y-8 md:rotate-[4deg]"
          >
            <OfflineScreen />
          </PhoneFrame>
        </div>
      </section>

      {/* ---- feature lineup ---- */}
      <section className="relative z-10 mt-28">
        <div className="flex items-end justify-between gap-6">
          <SectionHeading
            eyebrow="Today's lineup"
            title="Built for the con floor"
          />
          <span className="mb-1 hidden font-tech text-[11px] text-muted-foreground uppercase tracking-[0.2em] sm:block">
            Day 1 of ∞
          </span>
        </div>

        <div className="mt-8 overflow-hidden rounded-2xl border border-border">
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
                <p className="mt-1 max-w-[52ch] text-[14.5px] text-muted-foreground leading-relaxed">
                  {item.body}
                </p>
              </div>
              <div className="col-start-2 mt-2 flex gap-2 sm:col-start-3 sm:mt-0 sm:flex-col sm:items-end">
                <span className="rounded-[6px] border border-primary/30 bg-primary/10 px-2 py-0.5 font-tech text-[10px] text-primary uppercase tracking-[0.18em]">
                  {item.tag}
                </span>
                <span className="pt-0.5 font-tech text-[10px] text-muted-foreground uppercase tracking-[0.18em]">
                  {item.room}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ---- stats strip ---- */}
      <section className="relative z-10 mt-28">
        <h2 className="sr-only">ConPaws at a glance</h2>
        <div className="grid gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
          {STATS.map((stat) => (
            <div key={stat.label} className="bg-card/60 px-7 py-8">
              <p className="font-bold text-[clamp(34px,4vw,44px)] text-primary leading-none tracking-[-0.02em]">
                {stat.value}
              </p>
              <p className="mt-2.5 font-tech text-[11px] text-muted-foreground uppercase tracking-[0.18em]">
                {stat.label}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ---- how it works ---- */}
      <section className="relative z-10 mt-28">
        <SectionHeading
          eyebrow="How it works"
          title="Three steps, zero setup"
        />
        <div className="mt-8 grid gap-3 sm:grid-cols-3">
          {STEPS.map((step) => (
            <div
              key={step.n}
              className="group hover:-translate-y-1 rounded-2xl border border-border bg-card/40 p-6 transition hover:border-primary/60 hover:bg-card"
            >
              <span className="font-bold text-[38px] text-transparent leading-none [-webkit-text-stroke:1.5px_rgb(15_172_237/0.55)] transition group-hover:text-primary group-hover:[-webkit-text-stroke:0px]">
                {step.n}
              </span>
              <h3 className="mt-4 font-bold text-[16px] tracking-tight">
                {step.title}
              </h3>
              <p className="mt-1.5 text-[14px] text-muted-foreground leading-relaxed">
                {step.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ---- FAQ ---- */}
      <section className="relative z-10 mt-28">
        <SectionHeading eyebrow="Con ops desk" title="Questions, answered" />
        <div className="mt-8 overflow-hidden rounded-2xl border border-border">
          {FAQ.map((item, i) => (
            <details
              key={item.q}
              className={`group bg-card/40 open:bg-card ${
                i > 0 ? "border-border border-t" : ""
              }`}
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-6 py-5 font-bold text-[15.5px] tracking-tight transition hover:text-primary [&::-webkit-details-marker]:hidden">
                {item.q}
                <span
                  aria-hidden="true"
                  className="text-[18px] text-primary transition group-open:rotate-45"
                >
                  +
                </span>
              </summary>
              <p className="max-w-[68ch] px-6 pb-5 text-[14.5px] text-muted-foreground leading-relaxed">
                {item.a}
              </p>
            </details>
          ))}
        </div>
      </section>

      {/* ---- closing CTA ---- */}
      <section className="relative z-10 mt-28">
        <div className="relative overflow-hidden rounded-3xl border border-primary/30 bg-gradient-to-b from-[#0f2350] to-card px-8 py-14 text-center sm:py-16">
          <CompassPaw className="-left-10 -bottom-10 absolute h-[180px] w-[180px] rotate-[-15deg] text-primary opacity-[0.07]" />
          <CompassPaw className="-right-8 -top-12 absolute h-[160px] w-[160px] rotate-[20deg] text-primary opacity-[0.07]" />
          <p className="font-tech text-[12px] text-primary uppercase tracking-[0.3em]">
            Registration line
          </p>
          <h2 className="mx-auto mt-3 max-w-[18ch] text-balance font-bold text-[clamp(28px,4.5vw,44px)] leading-[1.05] tracking-[-0.02em]">
            Your badge is waiting at the front desk
          </h2>
          <p className="mx-auto mt-4 max-w-[46ch] text-[15px] text-muted-foreground leading-relaxed">
            Join the waitlist and you&rsquo;ll get exactly one email when the
            beta opens — nothing else, ever.
          </p>
          <a
            href="#waitlist"
            className="mt-8 inline-block rounded-xl bg-primary px-8 py-4 font-bold text-[14px] text-primary-foreground uppercase tracking-[0.14em] transition hover:brightness-110 hover:shadow-[0_0_36px_rgb(15_172_237/0.35)] active:scale-[0.99]"
          >
            Get in line →
          </a>
        </div>
      </section>

      {/* ---- footer ---- */}
      <footer className="relative z-10 mt-28 overflow-hidden border-border border-t pt-10">
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
              <span className="font-tech text-[11px] text-muted-foreground uppercase tracking-[0.16em]">
                by{" "}
                <a
                  href="https://www.mrdemonwolf.com"
                  rel="noopener"
                  className="text-primary transition hover:underline"
                >
                  MrDemonWolf,&nbsp;Inc.
                </a>
              </span>
            </span>
            <p className="mt-2 font-tech text-[11px] text-muted-foreground uppercase tracking-[0.18em]">
              © {new Date().getFullYear()} MrDemonWolf, Inc. All rights
              reserved.
            </p>
          </div>
          <nav className="flex gap-5 font-tech text-[12px] text-muted-foreground uppercase tracking-[0.18em]">
            <a
              href="https://github.com/MrDemonWolf/conpaws"
              rel="noopener"
              className="transition hover:text-primary"
            >
              GitHub
            </a>
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
