import { CompassPaw } from "@/components/compass-paw";
import { FaqSection } from "@/components/faq";
import { Waitlist } from "@/components/waitlist";
import {
  FAQ_HEADING,
  LINEUP,
  STATS,
  STEPS,
  TICKER_ITEMS,
} from "@/content/landing";

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
        Schedules, offline first, reminders, content flags, iOS, Android.
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

/**
 * The convention shown in the mockups is invented, and has to stay that way.
 *
 * Putting a real convention's name on marketing screenshots implies a
 * partnership or an endorsement that does not exist, and the name is very
 * likely someone's trademark. Test fixtures elsewhere in the repo do use real
 * feeds — that is a compatibility concern and stays internal.
 */
const SAMPLE_CON = "Glasswing Furmeet 2026";
const SAMPLE_CON_SHORT = "Glasswing";

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
        {/*
          A real capture is 1320x2868, so the frame is held at that ratio
          rather than a round pixel height. A fixed height quietly crops or
          letterboxes the day someone drops an <Image> in here.
        */}
        <div className="relative aspect-[1320/2868] overflow-hidden rounded-[29px] border border-border/60 bg-background">
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
  con,
  starred,
  flag,
}: {
  time: string;
  title: string;
  room: string;
  /** Which convention the row belongs to — only shown in the Schedule tab. */
  con?: string;
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
          {con ? `${con} · ${room}` : room}
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

// The first tab is labelled "Conventions" in the app, not "Home" — the
// route group is (home) but the string is t("home.title").
const TABS = ["Conventions", "Schedule", "Settings"] as const;

function TabBar({ active }: { active: (typeof TABS)[number] }) {
  return (
    <div className="mt-auto flex items-center justify-around border-border border-t pt-2.5">
      {TABS.map((tab) => (
        <span
          key={tab}
          className={`font-tech text-[9px] uppercase tracking-[0.12em] ${
            tab === active ? "text-primary" : "text-muted-foreground/70"
          }`}
        >
          {tab}
        </span>
      ))}
    </div>
  );
}

function ScreenChrome({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full flex-col px-3 pt-9 pb-3 text-foreground">
      {children}
    </div>
  );
}

/**
 * The Schedule tab: every starred event from every saved convention, grouped
 * by day. Rows name their convention only when more than one is in play,
 * which is exactly what the app does.
 */
function ScheduleScreen() {
  return (
    <ScreenChrome>
      <p className="font-bold text-[19px] leading-tight tracking-tight">
        Schedule
      </p>
      <p className="mt-1 text-[9px] text-muted-foreground">
        Times are shown in each convention's local time.
      </p>
      <p className="mt-3 font-bold text-[12px] tracking-tight">
        Saturday, July 4
      </p>
      <div className="mt-2 flex flex-col gap-2">
        <MiniEvent
          time="10:00"
          title="Fursuit Parade"
          con={SAMPLE_CON_SHORT}
          room="Main Hall"
          starred
        />
        <MiniEvent
          time="13:00"
          title="Dealers' Den"
          con={SAMPLE_CON_SHORT}
          room="Hall B"
          starred
        />
        <MiniEvent
          time="20:00"
          title="DJ Night"
          con={SAMPLE_CON_SHORT}
          room="Ballroom"
          starred
          flag="18+"
        />
      </div>
      <p className="mt-4 font-bold text-[12px] tracking-tight">
        Sunday, July 5
      </p>
      <div className="mt-2 flex flex-col gap-2">
        <MiniEvent
          time="11:00"
          title="Closing Ceremonies"
          con={SAMPLE_CON_SHORT}
          room="Main Hall"
          starred
        />
      </div>
      <TabBar active="Schedule" />
    </ScreenChrome>
  );
}

/**
 * Tapping an event opens an action sheet over the schedule. The app has no
 * event detail screen, deliberately — stars and reminders live in one place.
 * This mockup used to show a full-page detail view the app has never had.
 */
function EventSheetScreen() {
  return (
    <div className="relative h-full">
      <ScreenChrome>
        <p className="font-tech text-[9px] text-muted-foreground uppercase tracking-[0.2em]">
          {SAMPLE_CON}
        </p>
        <p className="mt-0.5 font-bold text-[16px] tracking-tight">Saturday</p>
        <div className="mt-3 flex flex-col gap-2">
          <MiniEvent
            time="10:00"
            title="Fursuit Parade"
            room="Main Hall"
            starred
          />
          <MiniEvent
            time="11:30"
            title="Drawing for Beginners"
            room="Panel 2"
          />
          <MiniEvent time="13:00" title="Dealers' Den" room="Hall B" starred />
        </div>
      </ScreenChrome>

      {/* scrim + sheet */}
      <div className="absolute inset-0 rounded-[29px] bg-black/45" />
      <div className="absolute inset-x-0 bottom-0 rounded-t-[16px] border-border border-t bg-card pb-3">
        <div className="mx-auto mt-2.5 mb-3 h-1 w-10 rounded-full bg-border" />
        <p className="px-3 font-bold text-[15px] leading-tight tracking-tight">
          Fursuit Parade
        </p>
        <p className="mt-1 px-3 text-[10px] text-muted-foreground">
          Saturday, July 4 at 10:00 to 11:00 · Main Hall
        </p>
        <div className="mt-2.5 flex flex-wrap gap-1.5 px-3">
          <span className="rounded-[5px] border border-primary/40 bg-primary/10 px-1.5 py-px font-tech text-[8px] text-primary uppercase tracking-[0.1em]">
            15 min before
          </span>
          <span className="rounded-[5px] border border-border px-1.5 py-px font-tech text-[8px] text-muted-foreground uppercase tracking-[0.1em]">
            Imported
          </span>
        </div>
        <p className="mt-2.5 px-3 text-[10px] text-muted-foreground leading-relaxed">
          Line up on the mezzanine by 9:40. The route ends at the photo wall.
        </p>
        <div className="mt-2 flex flex-col">
          {[
            "Remove from My Schedule",
            "Change leave reminder",
            "View on Sched",
          ].map((action) => (
            <span key={action} className="px-3 py-2 text-[11px] leading-tight">
              {action}
            </span>
          ))}
          <span className="mt-1 border-border border-t px-3 pt-2 text-center text-[11px] text-muted-foreground">
            Close
          </span>
        </div>
      </div>
    </div>
  );
}

/**
 * Now and Next inside a convention.
 *
 * This used to show a "no connection" banner and a "saved on device" card.
 * The app has neither, and never has: it is local-first, so there is no
 * network state to report and nothing to reassure the user about mid-session.
 * The offline claim belongs in the copy around the phone, not in invented
 * chrome pretending to be a screen the app can render.
 */
function OfflineScreen() {
  return (
    <ScreenChrome>
      <p className="font-tech text-[9px] text-muted-foreground uppercase tracking-[0.2em]">
        {SAMPLE_CON}
      </p>
      <p className="mt-0.5 font-bold text-[16px] tracking-tight">
        Now and Next
      </p>
      <p className="mt-1 text-[9px] text-muted-foreground">
        Times shown in America/Chicago
      </p>
      <p className="mt-3 font-bold text-[12px] tracking-tight">Now (1)</p>
      <div className="mt-2 flex flex-col gap-2">
        <MiniEvent time="13:00" title="Dealers' Den" room="Hall B" starred />
      </div>
      <p className="mt-4 font-bold text-[12px] tracking-tight">
        Next at 14:30 (2)
      </p>
      <div className="mt-2 flex flex-col gap-2">
        <MiniEvent time="14:30" title="Writing Furry Fiction" room="Panel 1" />
        <MiniEvent time="14:30" title="Fursuit Repair Clinic" room="Panel 3" />
      </div>
      <TabBar active="Conventions" />
    </ScreenChrome>
  );
}

/* ------------------------------------------------------------------------ */

export default function Home() {
  return (
    <main className="relative mx-auto max-w-[1120px] px-6 pb-28">
      <nav className="relative z-20 flex items-center justify-between py-7">
        <span className="flex items-center gap-3">
          <CompassPaw className="h-10 w-10 text-primary" />
          <b className="font-bold text-[22px] tracking-tight">ConPaws</b>
        </span>
        <span className="rounded-full border border-border px-3 py-1 font-tech text-[11px] text-muted-foreground uppercase tracking-[0.2em]">
          Est. 2025
        </span>
      </nav>

      {/* No z-index here on purpose. `relative` alone does not open a stacking
          context, so the badge inside can raise itself above the nav and every
          section below — it hangs on a lanyard that runs off the top, and it
          should read as hanging in front of the page, not trapped behind it.
          Adding a z-index back to this section would box the badge in. */}
      <section id="waitlist" className="relative pt-6">
        <Waitlist />
      </section>

      <Ticker />

      {/* ---- a look inside ---- */}
      <section className="relative z-10 mt-28">
        <SectionHeading
          eyebrow="A look inside"
          title="Your whole weekend, one thumb"
          blurb="Illustrations of the real screens, drawn to match. The schedule you build is the schedule you see — no feeds, no algorithm, no pull-to-refresh roulette."
        />
        <div className="mt-12 flex flex-wrap items-start justify-center gap-8 md:gap-6">
          <PhoneFrame
            label="Build your weekend"
            className="md:translate-y-8 md:rotate-[-4deg]"
          >
            <ScheduleScreen />
          </PhoneFrame>
          <PhoneFrame label="Never miss a lineup" className="z-10">
            <EventSheetScreen />
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
        <SectionHeading
          eyebrow={FAQ_HEADING.eyebrow}
          title={FAQ_HEADING.title}
        />
        <FaqSection />
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
        <div className="relative flex flex-wrap items-center justify-between gap-6 pb-8">
          <p className="font-tech text-[11px] text-muted-foreground uppercase tracking-[0.18em]">
            © {new Date().getFullYear()} ConPaws by{" "}
            <a
              href="https://www.mrdemonwolf.com"
              rel="noopener"
              className="text-primary transition hover:underline"
            >
              MrDemonWolf,&nbsp;Inc.
            </a>
          </p>
          <nav className="flex gap-5 font-tech text-[12px] text-muted-foreground uppercase tracking-[0.18em]">
            <a href="/support" className="transition hover:text-primary">
              Support
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
