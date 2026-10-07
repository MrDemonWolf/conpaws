import { CompassPaw } from "@/components/compass-paw";
import { Countdown } from "@/components/countdown";
import { NavPill, PageShell } from "@/components/page-shell";
import { LAUNCH, type LaunchConfig, type SiteMode } from "@/content/launch";
import type { Messages } from "@/i18n";
import type { Locale } from "@/i18n/config";

export function SiteModePage({
  mode,
  locale,
  messages,
  launch = LAUNCH,
}: {
  mode: Extract<SiteMode, "coming-soon" | "maintenance">;
  locale: Locale;
  messages: Messages;
  launch?: LaunchConfig;
}) {
  const copy =
    mode === "coming-soon"
      ? {
          eyebrow: "Coming soon",
          title: "A new den is almost ready.",
          body: "We’re putting the finishing touches on ConPaws. The doors open when the countdown hits zero.",
        }
      : {
          eyebrow: "Quick den tune-up",
          title: "We’ll be back in a bit.",
          body: "The site is taking a quick nap while we tidy things up. Give us a little while, then come back for another look.",
        };
  const body =
    mode === "maintenance" && launch.maintenanceMessage
      ? launch.maintenanceMessage
      : copy.body;

  return (
    <PageShell
      locale={locale}
      messages={messages}
      navAside={<NavPill>{copy.eyebrow}</NavPill>}
    >
      <section className="relative mx-auto my-10 grid min-h-[min(62svh,680px)] max-w-[920px] place-items-center overflow-hidden rounded-[32px] border border-primary/20 bg-[radial-gradient(ellipse_at_50%_0%,rgb(15_172_237/0.16),transparent_58%),linear-gradient(155deg,#0b1a3a,#101b32_62%,#0b1428)] px-5 py-14 text-center shadow-[0_24px_90px_rgb(0_0_0/0.22)] sm:my-14 sm:px-12 sm:py-20">
        <CompassPaw
          aria-hidden="true"
          className="pointer-events-none absolute -right-14 -bottom-16 h-[240px] w-[240px] rotate-[-18deg] text-primary opacity-[0.08] sm:-right-10 sm:-bottom-20 sm:h-[320px] sm:w-[320px]"
        />
        <div className="relative z-10 max-w-[620px]">
          <span className="mx-auto inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-4 py-2 font-tech text-[10px] text-primary uppercase tracking-[0.2em] sm:text-[11px]">
            <span className="h-2 w-2 rounded-full bg-primary" />
            {copy.eyebrow}
          </span>
          <CompassPaw
            aria-hidden="true"
            className="mx-auto mt-8 h-16 w-16 text-primary sm:h-20 sm:w-20"
          />
          <h1 className="mt-7 text-balance font-bold text-[clamp(34px,8vw,62px)] leading-[1.02] tracking-[-0.035em]">
            {copy.title}
          </h1>
          <p className="mx-auto mt-5 max-w-[46ch] text-[15px] text-muted-foreground leading-relaxed sm:text-[17px]">
            {body}
          </p>
          {mode === "coming-soon" && launch.countdownAt && (
            <Countdown
              target={launch.countdownAt}
              labels={{
                days: "Days",
                hours: "Hours",
                minutes: "Minutes",
                seconds: "Seconds",
                ariaLabel: "Time until ConPaws is ready",
              }}
            />
          )}
        </div>
      </section>
    </PageShell>
  );
}
