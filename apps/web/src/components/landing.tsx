import Link from "next/link";
import { AppPreview, type AppPreviewScreen } from "@/components/app-preview";
import { CompassPaw } from "@/components/compass-paw";
import { FaqSection } from "@/components/faq";
import { JsonLd } from "@/components/json-ld";
import { SiteHeader } from "@/components/site-header";
import { Waitlist } from "@/components/waitlist";
import { UPDATES_LABEL } from "@/content/changelog";
import { LINEUP, STEPS } from "@/content/landing";
import { LAUNCH, type LaunchConfig } from "@/content/launch";
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
 * App previews are static captures of the approved code-based review screens.
 * They use fictional data and are labeled as development previews.
 *
 * Copy comes from the locale catalog (`src/i18n/messages/*.json`). What stays
 * in `content/landing.ts` is the part that is structure rather than language:
 * the decorative programme times, the `tag` union that drives badge styling,
 * and the step numbers. Those are zipped with the
 * translated titles and bodies by index, so the two files must keep the same
 * number of entries — a mismatch is a missing row, not a crash.
 */

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
      <h2 className="mt-3 text-balance font-bold text-[clamp(32px,4vw,44px)] leading-[1.15] tracking-[-0.02em]">
        {title}
      </h2>
      {blurb ? (
        <p className="mt-4 text-base text-muted-foreground leading-relaxed sm:text-lg">
          {blurb}
        </p>
      ) : null}
    </div>
  );
}

export function Landing({
  locale,
  messages,
  launch = LAUNCH,
}: {
  locale: Locale;
  messages: Messages;
  launch?: LaunchConfig;
}) {
  const year = new Date().getFullYear();
  const screens: AppPreviewScreen[] = [
    {
      id: "browse",
      title: messages.showcase.browseTitle,
      description: messages.showcase.browseDescription,
      src: "/app-preview/browse.png",
      darkSrc: "/app-preview/browse-dark.png",
      alt: messages.showcase.browseDescription,
    },
    {
      id: "plan",
      title: messages.showcase.planTitle,
      description: messages.showcase.planDescription,
      src: "/app-preview/plan.png",
      darkSrc: "/app-preview/plan-dark.png",
      alt: messages.showcase.planDescription,
    },
    {
      id: "reminders",
      title: messages.showcase.remindersTitle,
      description: messages.showcase.remindersDescription,
      src: "/app-preview/reminders.png",
      darkSrc: "/app-preview/reminders-dark.png",
      alt: messages.showcase.remindersDescription,
    },
  ];

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
    <>
      <a
        href="#main"
        className="sr-only rounded-lg bg-primary px-4 py-2 font-tech text-primary-foreground text-[12px] uppercase tracking-[0.18em] focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-skip"
      >
        {messages.nav.skipToContent}
      </a>
      <SiteHeader
        locale={locale}
        messages={messages}
        homePage
        showWaitlist={launch.mode === "waitlist"}
      />
      <div className="landing-page marketing-shell relative z-content isolate mx-auto max-w-[1120px] px-6 pb-[max(24px,env(safe-area-inset-bottom))]">
        <main id="main">
          <section
            className="landing-hero grid items-center gap-8 border-b border-border py-8 sm:py-10 lg:grid-cols-[minmax(0,1fr)_280px] lg:gap-12"
            aria-labelledby="hero-title"
          >
            <div>
              <p className="font-tech text-xs text-primary uppercase tracking-[0.14em]">
                {messages.hero.eyebrow}
              </p>
              <h1
                id="hero-title"
                className="mt-5 text-balance font-bold text-[clamp(38px,8vw,64px)] leading-[1.06] tracking-[-0.035em]"
              >
                {messages.hero.title}
                <br />
                <span className="text-primary">
                  {messages.hero.titleAccent}
                </span>
              </h1>
              <p className="mt-6 max-w-[43ch] text-base text-muted-foreground leading-relaxed sm:text-lg">
                {messages.hero.body}
              </p>
              <div className="mt-7 flex flex-wrap items-center gap-4">
                <a
                  href="#waitlist"
                  className="waitlist-motion inline-flex min-h-12 items-center justify-center rounded-xl bg-primary px-6 py-3 font-bold text-primary-foreground"
                >
                  {launch.mode === "live"
                    ? messages.steps.items[0]?.title
                    : messages.nav.joinWaitlist}
                </a>
                <a
                  href="#inside"
                  className="inline-flex min-h-11 items-center text-sm underline-offset-4 hover:underline"
                >
                  {messages.hero.secondary}{" "}
                  <span aria-hidden="true" className="ml-2">
                    ↓
                  </span>
                </a>
              </div>
              <p className="mt-4 text-sm text-muted-foreground">
                {launch.mode === "live"
                  ? "iOS · Android"
                  : messages.hero.platforms}
              </p>
            </div>
            <AppPreview
              screens={screens}
              label={messages.showcase.label}
              note={messages.showcase.note}
              rotationLabels={messages.showcase.rotation}
            />
          </section>

          {/* ---- a look inside ---- */}
          <section id="inside" className="relative z-content mt-10 sm:mt-14">
            <SectionHeading
              eyebrow={messages.inside.eyebrow}
              title={messages.inside.title}
              blurb={messages.inside.blurb}
            />
            <div className="mt-8 sm:mt-12">
              <AppPreview
                screens={screens}
                label={messages.showcase.label}
                note={messages.showcase.note}
                rotationLabels={messages.showcase.rotation}
                variant="gallery"
              />
            </div>
          </section>

          {/* ---- feature lineup ---- */}
          <section id="features" className="relative z-content mt-20 sm:mt-24">
            <div className="flex items-end justify-between gap-6">
              <SectionHeading
                eyebrow={messages.lineup.eyebrow}
                title={messages.lineup.title}
              />
              <span className="mb-1 hidden font-tech text-[11px] text-muted-foreground uppercase tracking-[0.2em] sm:block">
                {messages.lineup.dayCounter}
              </span>
            </div>

            <div className="landing-block mt-8 overflow-hidden rounded-2xl border border-border">
              {LINEUP.map((item, i) => {
                const copy = messages.lineup.items[i];
                if (!copy) return null;
                return (
                  <div
                    key={item.time}
                    className={`group grid grid-cols-[max-content_minmax(0,1fr)] items-start gap-x-5 px-5 py-5 transition hover:bg-card sm:grid-cols-[max-content_minmax(0,1fr)_auto] sm:px-7 ${
                      i > 0 ? "border-border border-t" : ""
                    }`}
                  >
                    <span className="pt-0.5 font-tech text-[15px] text-primary tracking-[0.06em]">
                      {item.time}
                    </span>
                    <div>
                      <h3 className="font-bold text-xl tracking-tight transition group-hover:text-primary">
                        {copy.title}
                      </h3>
                      <p className="mt-1 max-w-[52ch] text-base text-muted-foreground leading-relaxed">
                        {copy.body}
                      </p>
                    </div>
                    <div className="col-start-2 mt-2 flex flex-wrap gap-2 sm:col-start-3 sm:mt-0 sm:flex-col sm:items-end">
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

          {/* ---- how it works ---- */}
          <section className="relative z-content mt-20 sm:mt-24">
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
                    className="landing-block group hover:-translate-y-1 rounded-2xl border border-border p-6 transition hover:border-primary/60 hover:bg-card"
                  >
                    <span className="font-bold text-[38px] text-transparent leading-none [-webkit-text-stroke:1.5px_rgb(15_172_237/0.55)] transition group-hover:text-primary group-hover:[-webkit-text-stroke:0px]">
                      {step.n}
                    </span>
                    <h3 className="mt-4 font-bold text-xl tracking-tight">
                      {copy.title}
                    </h3>
                    <p className="mt-1.5 text-base text-muted-foreground leading-relaxed">
                      {copy.body}
                    </p>
                  </div>
                );
              })}
            </div>
          </section>

          <section
            id="waitlist"
            className="relative mt-20 border-t border-border pt-12 sm:mt-24"
            aria-label={messages.nav.joinWaitlist}
          >
            <Waitlist
              messages={{
                ...messages.waitlist,
                title: messages.nav.joinWaitlist,
                titleAccent: "",
              }}
              launch={launch}
              headingLevel="h2"
            />
          </section>

          {/* ---- FAQ ---- */}
          <section id="faq" className="relative z-content mt-20 sm:mt-24">
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
                softwareApplicationNode(locale, messages, launch),
                faqPageNode(messages),
              )}
            />
          </section>

          {/* ---- closing CTA ---- */}
          <section className="relative z-content mt-20 sm:mt-28">
            <div className="relative overflow-hidden rounded-3xl border border-border bg-card px-5 py-10 text-center sm:px-8 sm:py-16">
              <CompassPaw className="-left-10 -bottom-10 absolute h-[180px] w-[180px] rotate-[-15deg] text-primary opacity-[0.07]" />
              <CompassPaw className="-right-8 -top-12 absolute h-[160px] w-[160px] rotate-[20deg] text-primary opacity-[0.07]" />
              <p className="font-tech text-[12px] text-primary uppercase tracking-[0.3em]">
                {messages.cta.eyebrow}
              </p>
              <h2 className="mx-auto mt-3 max-w-[18ch] text-balance font-bold text-[clamp(32px,4.5vw,44px)] leading-[1.15] tracking-[-0.02em]">
                {messages.cta.title}
              </h2>
              <p className="mx-auto mt-4 max-w-[46ch] text-lg text-muted-foreground leading-relaxed">
                {messages.cta.body}
              </p>
              <a
                href="#waitlist"
                className="mt-8 inline-block rounded-xl bg-primary px-8 py-4 font-bold text-base text-primary-foreground uppercase tracking-[0.08em] transition hover:brightness-110 hover:shadow-[0_0_36px_rgb(15_172_237/0.35)] active:scale-[0.99]"
              >
                {messages.cta.button}
              </a>
            </div>
          </section>
        </main>

        {/* ---- footer ---- */}
        <footer className="relative z-content mt-20 overflow-hidden border-border border-t pt-8 sm:mt-28 sm:pt-10">
          {/* Decorative wordmark. Hidden below `sm` on purpose: at 375px the
            120px type is wider than the viewport, so it clipped to a
            meaningless "nPaws" AND sat directly behind the footer links --
            every one of the three was 100% covered, which is what made the
            footer look broken on a phone. */}
          <p
            aria-hidden="true"
            className="pointer-events-none absolute right-0 bottom-[-30px] hidden select-none font-bold text-transparent leading-none tracking-tighter [-webkit-text-stroke:1px_var(--border)] sm:block sm:text-[170px]"
          >
            ConPaws
          </p>
          <div className="relative flex flex-wrap items-center justify-between gap-6 pb-8">
            <p className="text-sm text-muted-foreground">
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
              className="-my-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground"
            >
              <a
                href="/updates"
                className="inline-flex min-h-11 items-center transition hover:text-primary"
              >
                {UPDATES_LABEL[locale]}
              </a>
              <Link
                href="/design-system"
                className="inline-flex min-h-11 items-center transition hover:text-primary"
              >
                {messages.footer.designSystem}
              </Link>
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
    </>
  );
}
