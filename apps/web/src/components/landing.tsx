import { CompassPaw } from "@/components/compass-paw";
import { FaqSection } from "@/components/faq";
import { JsonLd } from "@/components/json-ld";
import { LanguageSwitcher } from "@/components/language-switcher";
import { Waitlist } from "@/components/waitlist";
import { LINEUP, STATS, STEPS } from "@/content/landing";
import type { Messages } from "@/i18n";
import type { Locale } from "@/i18n/config";
import {
  faqPageNode,
  graph,
  softwareApplicationNode,
} from "@/lib/structured-data";

/**
 * The pre-release landing page, styled as a convention program guide — the
 * product is a schedule app, so the whole page reads like one. Everything
 * here is launch-stable: at go-live only copy changes (the waitlist flag,
 * store links when they exist), never structure.
 *
 * The "screenshots" are DOM mockups of the app UI drawn with the same brand
 * tokens. When real captures exist, each <PhoneFrame> body is swapped for an
 * <Image> without touching the layout around it.
 *
 * Copy comes from the locale catalog (`src/i18n/messages/*.json`). What stays
 * in `content/landing.ts` is the part that is structure rather than language:
 * the decorative programme times, the `tag` union that drives badge styling,
 * the stat *values*, and the step numbers. Those are zipped with the
 * translated titles and bodies by index, so the two files must keep the same
 * number of entries — a mismatch is a missing row, not a crash.
 */

function Ticker({ messages }: { messages: Messages }) {
  const row = messages.ticker.items.map((item) => (
    <span key={item} className="flex items-center gap-6 pr-6">
      {/* Filled, not outlined. These were transparent with a 1px stroke, which
          is a fine effect on the 170px footer wordmark and unreadable at 15px:
          a hairline outline leaves the letterform mostly background, so the
          eye gets no shape to lock onto and the whole strip reads as texture.
          The other two outlined elements on this page are 38px and 170px and
          keep the effect. */}
      <span className="font-display font-semibold text-[15px] text-slate-300 uppercase tracking-[0.14em]">
        {item}
      </span>
      <CompassPaw className="h-3.5 w-3.5 shrink-0 text-primary/50" />
    </span>
  ));

  return (
    <div className="relative z-content mt-28 overflow-hidden border-border border-y bg-background/80 py-5">
      <p className="sr-only">{messages.ticker.screenReaderSummary}</p>
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
 * likely someone's trademark. It is not in the locale catalogs either: an
 * invented proper noun does not translate.
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

function TabBar({
  messages,
  active,
}: {
  messages: Messages;
  active: "conventions" | "schedule";
}) {
  const tabs = [
    ["conventions", messages.mock.tabs.conventions],
    ["schedule", messages.mock.tabs.schedule],
    ["settings", messages.mock.tabs.settings],
  ] as const;

  return (
    <div className="mt-auto flex items-center justify-around border-border border-t pt-2.5">
      {tabs.map(([key, label]) => (
        <span
          key={key}
          className={`font-tech text-[9px] uppercase tracking-[0.12em] ${
            key === active ? "text-primary" : "text-muted-foreground/70"
          }`}
        >
          {label}
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
function ScheduleScreen({ messages }: { messages: Messages }) {
  const m = messages.mock;
  return (
    <ScreenChrome>
      <p className="font-bold text-[19px] leading-tight tracking-tight">
        {m.scheduleTitle}
      </p>
      <p className="mt-1 text-[9px] text-muted-foreground">
        {m.scheduleTimezoneNote}
      </p>
      <p className="mt-3 font-bold text-[12px] tracking-tight">
        {m.daySaturdayFull}
      </p>
      <div className="mt-2 flex flex-col gap-2">
        <MiniEvent
          time="10:00"
          title={m.events.fursuitParade}
          con={SAMPLE_CON_SHORT}
          room={m.rooms.mainHall}
          starred
        />
        <MiniEvent
          time="13:00"
          title={m.events.dealersDen}
          con={SAMPLE_CON_SHORT}
          room={m.rooms.hallB}
          starred
        />
        <MiniEvent
          time="20:00"
          title={m.events.djNight}
          con={SAMPLE_CON_SHORT}
          room={m.rooms.ballroom}
          starred
          flag="18+"
        />
      </div>
      <p className="mt-4 font-bold text-[12px] tracking-tight">
        {m.daySundayFull}
      </p>
      <div className="mt-2 flex flex-col gap-2">
        <MiniEvent
          time="11:00"
          title={m.events.closingCeremonies}
          con={SAMPLE_CON_SHORT}
          room={m.rooms.mainHall}
          starred
        />
      </div>
      <TabBar messages={messages} active="schedule" />
    </ScreenChrome>
  );
}

/**
 * Tapping an event opens an action sheet over the schedule. The app has no
 * event detail screen, deliberately — stars and reminders live in one place.
 */
function EventSheetScreen({ messages }: { messages: Messages }) {
  const m = messages.mock;
  return (
    <div className="relative h-full">
      <ScreenChrome>
        <p className="font-tech text-[9px] text-muted-foreground uppercase tracking-[0.2em]">
          {SAMPLE_CON}
        </p>
        <p className="mt-0.5 font-bold text-[16px] tracking-tight">
          {m.daySaturday}
        </p>
        <div className="mt-3 flex flex-col gap-2">
          <MiniEvent
            time="10:00"
            title={m.events.fursuitParade}
            room={m.rooms.mainHall}
            starred
          />
          <MiniEvent
            time="11:30"
            title={m.events.drawingForBeginners}
            room={m.rooms.panel2}
          />
          <MiniEvent
            time="13:00"
            title={m.events.dealersDen}
            room={m.rooms.hallB}
            starred
          />
        </div>
      </ScreenChrome>

      {/* scrim + sheet */}
      <div className="absolute inset-0 rounded-[29px] bg-black/45" />
      <div className="absolute inset-x-0 bottom-0 rounded-t-[16px] border-border border-t bg-card pb-3">
        <div className="mx-auto mt-2.5 mb-3 h-1 w-10 rounded-full bg-border" />
        <p className="px-3 font-bold text-[15px] leading-tight tracking-tight">
          {m.events.fursuitParade}
        </p>
        <p className="mt-1 px-3 text-[10px] text-muted-foreground">
          {m.sheet.when}
        </p>
        <div className="mt-2.5 flex flex-wrap gap-1.5 px-3">
          <span className="rounded-[5px] border border-primary/40 bg-primary/10 px-1.5 py-px font-tech text-[8px] text-primary uppercase tracking-[0.1em]">
            {m.sheet.reminderChip}
          </span>
          <span className="rounded-[5px] border border-border px-1.5 py-px font-tech text-[8px] text-muted-foreground uppercase tracking-[0.1em]">
            {m.sheet.importedChip}
          </span>
        </div>
        <p className="mt-2.5 px-3 text-[10px] text-muted-foreground leading-relaxed">
          {m.sheet.note}
        </p>
        <div className="mt-2 flex flex-col">
          {[
            m.sheet.actionRemove,
            m.sheet.actionChangeReminder,
            m.sheet.actionViewOnSched,
          ].map((action) => (
            <span key={action} className="px-3 py-2 text-[11px] leading-tight">
              {action}
            </span>
          ))}
          <span className="mt-1 border-border border-t px-3 pt-2 text-center text-[11px] text-muted-foreground">
            {m.sheet.close}
          </span>
        </div>
      </div>
    </div>
  );
}

/**
 * Now and Next inside a convention. The app is local-first, so there is no
 * network state to report — the offline claim belongs in the copy around the
 * phone, not in invented chrome pretending to be a screen the app can render.
 */
function OfflineScreen({ messages }: { messages: Messages }) {
  const m = messages.mock;
  return (
    <ScreenChrome>
      <p className="font-tech text-[9px] text-muted-foreground uppercase tracking-[0.2em]">
        {SAMPLE_CON}
      </p>
      <p className="mt-0.5 font-bold text-[16px] tracking-tight">
        {m.offlineTitle}
      </p>
      <p className="mt-1 text-[9px] text-muted-foreground">
        {m.offlineTimezoneNote}
      </p>
      <p className="mt-3 font-bold text-[12px] tracking-tight">{m.nowCount}</p>
      <div className="mt-2 flex flex-col gap-2">
        <MiniEvent
          time="13:00"
          title={m.events.dealersDen}
          room={m.rooms.hallB}
          starred
        />
      </div>
      <p className="mt-4 font-bold text-[12px] tracking-tight">{m.nextAt}</p>
      <div className="mt-2 flex flex-col gap-2">
        <MiniEvent
          time="14:30"
          title={m.events.writingFurryFiction}
          room={m.rooms.panel1}
        />
        <MiniEvent
          time="14:30"
          title={m.events.fursuitRepairClinic}
          room={m.rooms.panel3}
        />
      </div>
      <TabBar messages={messages} active="conventions" />
    </ScreenChrome>
  );
}

/* ------------------------------------------------------------------------ */

export function Landing({
  locale,
  messages,
}: {
  locale: Locale;
  messages: Messages;
}) {
  const year = new Date().getFullYear();

  return (
    // No `lang` here any more. It used to be set on this <div> because the
    // single root layout could not see the locale, which left <html lang="en">
    // on all 23 languages -- and that is the attribute browsers use to offer a
    // translation and Google reads as a language signal. `app/[locale]/layout.tsx`
    // is a second root layout and sets it properly; see components/document.tsx.
    // A wrapper, not <main>: <main> used to contain the header nav and the
    // footer, which makes the footer not a contentinfo landmark and leaves the
    // page with no banner landmark at all -- so landmark navigation offered
    // exactly one destination, "main", on every page.
    <div className="relative mx-auto max-w-[1120px] px-6 pb-28">
      <a
        href="#main"
        className="sr-only rounded-lg bg-primary px-4 py-2 font-tech text-primary-foreground text-[12px] uppercase tracking-[0.18em] focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-menu"
      >
        {messages.nav.skipToContent}
      </a>
      <header>
        <nav
          aria-label={messages.nav.primaryLabel}
          className="relative z-nav flex items-center justify-between py-7 has-[details[open]]:z-menu"
        >
          <span className="flex items-center gap-3">
            <CompassPaw className="h-10 w-10 text-primary" />
            <b className="font-bold text-[22px] tracking-tight">ConPaws</b>
          </span>
          <span className="flex items-center gap-3">
            <span className="hidden rounded-full border border-border px-3 py-1 font-tech text-[11px] text-muted-foreground uppercase tracking-[0.2em] sm:inline">
              {messages.nav.established}
            </span>
            <LanguageSwitcher
              current={locale}
              label={messages.nav.languageLabel}
            />
          </span>
        </nav>
      </header>

      <main id="main">
        {/* No z-index here on purpose. `relative` alone does not open a stacking
          context, so the badge inside can raise itself above the nav and every
          section below — it hangs on a lanyard that runs off the top, and it
          should read as hanging in front of the page, not trapped behind it.
          Adding a z-index back to this section would box the badge in. */}
        <section id="waitlist" className="relative pt-6">
          <Waitlist messages={messages.waitlist} />
        </section>

        <Ticker messages={messages} />

        {/* ---- a look inside ---- */}
        <section className="relative z-content mt-28">
          <SectionHeading
            eyebrow={messages.inside.eyebrow}
            title={messages.inside.title}
            blurb={messages.inside.blurb}
          />
          <div className="mt-12 flex flex-wrap items-start justify-center gap-8 md:gap-6">
            <PhoneFrame
              label={messages.inside.frameSchedule}
              className="md:translate-y-8 md:rotate-[-4deg]"
            >
              <ScheduleScreen messages={messages} />
            </PhoneFrame>
            <PhoneFrame label={messages.inside.frameEvent} className="z-10">
              <EventSheetScreen messages={messages} />
            </PhoneFrame>
            <PhoneFrame
              label={messages.inside.frameOffline}
              className="md:translate-y-8 md:rotate-[4deg]"
            >
              <OfflineScreen messages={messages} />
            </PhoneFrame>
          </div>
        </section>

        {/* ---- feature lineup ---- */}
        <section className="relative z-content mt-28">
          <div className="flex items-end justify-between gap-6">
            <SectionHeading
              eyebrow={messages.lineup.eyebrow}
              title={messages.lineup.title}
            />
            <span className="mb-1 hidden font-tech text-[11px] text-muted-foreground uppercase tracking-[0.2em] sm:block">
              {messages.lineup.dayCounter}
            </span>
          </div>

          <div className="mt-8 overflow-hidden rounded-2xl border border-border">
            {LINEUP.map((item, i) => {
              const copy = messages.lineup.items[i];
              if (!copy) return null;
              return (
                <div
                  key={item.time}
                  className={`group grid grid-cols-[64px_1fr] items-start gap-x-5 bg-card/40 px-5 py-5 transition hover:bg-card sm:grid-cols-[80px_1fr_auto] sm:px-7 ${
                    i > 0 ? "border-border border-t" : ""
                  }`}
                >
                  <span className="pt-0.5 font-tech text-[15px] text-primary tracking-[0.06em]">
                    {item.time}
                  </span>
                  <div>
                    <h3 className="font-bold text-[17px] tracking-tight transition group-hover:text-primary">
                      {copy.title}
                    </h3>
                    <p className="mt-1 max-w-[52ch] text-[14.5px] text-muted-foreground leading-relaxed">
                      {copy.body}
                    </p>
                  </div>
                  <div className="col-start-2 mt-2 flex gap-2 sm:col-start-3 sm:mt-0 sm:flex-col sm:items-end">
                    <span className="rounded-[6px] border border-primary/30 bg-primary/10 px-2 py-0.5 font-tech text-[10px] text-primary uppercase tracking-[0.18em]">
                      {messages.lineup.tags[item.tag]}
                    </span>
                    <span className="pt-0.5 font-tech text-[10px] text-muted-foreground uppercase tracking-[0.18em]">
                      {copy.room}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ---- stats strip ---- */}
        <section className="relative z-content mt-28">
          <h2 className="sr-only">{messages.stats.screenReaderHeading}</h2>
          <div className="grid gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
            {STATS.map((stat, i) => (
              <div key={stat.value} className="bg-card/60 px-7 py-8">
                <p className="font-bold text-[clamp(34px,4vw,44px)] text-primary leading-none tracking-[-0.02em]">
                  {stat.value}
                </p>
                <p className="mt-2.5 font-tech text-[11px] text-muted-foreground uppercase tracking-[0.18em]">
                  {messages.stats.labels[i] ?? stat.label}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* ---- how it works ---- */}
        <section className="relative z-content mt-28">
          <SectionHeading
            eyebrow={messages.steps.eyebrow}
            title={messages.steps.title}
          />
          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            {STEPS.map((step, i) => {
              const copy = messages.steps.items[i];
              if (!copy) return null;
              return (
                <div
                  key={step.n}
                  className="group hover:-translate-y-1 rounded-2xl border border-border bg-card/40 p-6 transition hover:border-primary/60 hover:bg-card"
                >
                  <span className="font-bold text-[38px] text-transparent leading-none [-webkit-text-stroke:1.5px_rgb(15_172_237/0.55)] transition group-hover:text-primary group-hover:[-webkit-text-stroke:0px]">
                    {step.n}
                  </span>
                  <h3 className="mt-4 font-bold text-[16px] tracking-tight">
                    {copy.title}
                  </h3>
                  <p className="mt-1.5 text-[14px] text-muted-foreground leading-relaxed">
                    {copy.body}
                  </p>
                </div>
              );
            })}
          </div>
        </section>

        {/* ---- FAQ ---- */}
        <section className="relative z-content mt-28">
          <SectionHeading
            eyebrow={messages.faq.eyebrow}
            title={messages.faq.title}
          />
          <FaqSection items={messages.faq.items} />
          {/* Derived from the same `messages.faq.items` the accordion just
              rendered, per locale. Structured data has to match the visible
              answers, and a second hardcoded copy is how it stops matching. */}
          <JsonLd
            data={graph(
              softwareApplicationNode(locale, messages),
              faqPageNode(messages),
            )}
          />
        </section>

        {/* ---- closing CTA ---- */}
        <section className="relative z-content mt-28">
          <div className="relative overflow-hidden rounded-3xl border border-primary/30 bg-gradient-to-b from-[#0f2350] to-card px-8 py-14 text-center sm:py-16">
            <CompassPaw className="-left-10 -bottom-10 absolute h-[180px] w-[180px] rotate-[-15deg] text-primary opacity-[0.07]" />
            <CompassPaw className="-right-8 -top-12 absolute h-[160px] w-[160px] rotate-[20deg] text-primary opacity-[0.07]" />
            <p className="font-tech text-[12px] text-primary uppercase tracking-[0.3em]">
              {messages.cta.eyebrow}
            </p>
            <h2 className="mx-auto mt-3 max-w-[18ch] text-balance font-bold text-[clamp(28px,4.5vw,44px)] leading-[1.05] tracking-[-0.02em]">
              {messages.cta.title}
            </h2>
            <p className="mx-auto mt-4 max-w-[46ch] text-[15px] text-muted-foreground leading-relaxed">
              {messages.cta.body}
            </p>
            <a
              href="#waitlist"
              className="mt-8 inline-block rounded-xl bg-primary px-8 py-4 font-bold text-[14px] text-primary-foreground uppercase tracking-[0.14em] transition hover:brightness-110 hover:shadow-[0_0_36px_rgb(15_172_237/0.35)] active:scale-[0.99]"
            >
              {messages.cta.button}
            </a>
          </div>
        </section>
      </main>

      {/* ---- footer ---- */}
      <footer className="relative z-content mt-28 overflow-hidden border-border border-t pt-10">
        {/* Decorative wordmark. Hidden below `sm` on purpose: at 375px the
            120px type is wider than the viewport, so it clipped to a
            meaningless "nPaws" AND sat directly behind the footer links --
            every one of the three was 100% covered, which is what made the
            footer look broken on a phone. */}
        <p
          aria-hidden="true"
          className="pointer-events-none absolute right-0 bottom-[-30px] hidden select-none font-bold text-transparent leading-none tracking-tighter [-webkit-text-stroke:1px_rgb(30_58_95/0.45)] sm:block sm:text-[170px]"
        >
          ConPaws
        </p>
        <div className="relative flex flex-wrap items-center justify-between gap-6 pb-8">
          <p className="font-tech text-[11px] text-muted-foreground uppercase tracking-[0.18em]">
            {messages.footer.copyright.replace("{year}", String(year))}{" "}
            <a
              href="https://www.mrdemonwolf.com"
              rel="noopener"
              className="text-primary transition hover:underline"
            >
              {messages.footer.company}
            </a>
          </p>
          {/* `min-h-11` is the 44px WCAG 2.5.8 target; the text is 12px, so
              without it these are ~18px tall and miss by half. The negative
              margin cancels the height it adds so the footer keeps its
              spacing. The MrDemonWolf link above is left alone on purpose --
              a link inside a sentence is exempt from the target-size rule. */}
          <nav
            aria-label={messages.nav.footerLabel}
            className="-my-3 flex gap-5 font-tech text-[12px] text-muted-foreground uppercase tracking-[0.18em]"
          >
            <a
              href="/support"
              className="inline-flex min-h-11 items-center transition hover:text-primary"
            >
              {messages.footer.support}
            </a>
            <a
              href="/privacy"
              className="inline-flex min-h-11 items-center transition hover:text-primary"
            >
              {messages.footer.privacy}
            </a>
            <a
              href="/terms"
              className="inline-flex min-h-11 items-center transition hover:text-primary"
            >
              {messages.footer.terms}
            </a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
