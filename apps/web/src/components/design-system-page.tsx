import { Badge } from "@conpaws/ui/components/badge";
import { Button, buttonVariants } from "@conpaws/ui/components/button";
import { Card, CardContent, CardHeader } from "@conpaws/ui/components/card";
import { Input } from "@conpaws/ui/components/input";
import type { CSSProperties, ReactNode } from "react";

import { CompassPaw } from "@/components/compass-paw";
import { PageShell } from "@/components/page-shell";
import { getMessages } from "@/i18n";
import styles from "./design-system-page.module.css";

const colorRoles = [
  ["Page", "background", "foreground"],
  ["Raised surface", "card", "card-foreground"],
  ["Primary action", "primary", "primary-foreground"],
  ["Supporting surface", "secondary", "secondary-foreground"],
  ["Quiet content", "muted", "muted-foreground"],
  ["Destructive action", "destructive", "destructive-foreground"],
] as const;

const sections = [
  ["brand", "Brand assets"],
  ["colors", "Colors"],
  ["typography", "Typography"],
  ["spacing", "Space & shape"],
  ["components", "Components"],
  ["accessibility", "Accessibility"],
  ["native", "Native platforms"],
] as const;

function ReferenceSection({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className="border-t border-border py-10 sm:py-14"
    >
      <div className="mb-6 max-w-[64ch]">
        <h2
          id={`${id}-title`}
          className="font-display text-2xl font-bold sm:text-3xl"
        >
          {title}
        </h2>
        <p className="mt-3 text-base text-muted-foreground leading-relaxed">
          {description}
        </p>
      </div>
      {children}
    </section>
  );
}

/** A live reference: samples consume the same tokens and primitives as the site. */
export function DesignSystemPage() {
  return (
    <PageShell messages={getMessages("en")}>
      <header className="grid gap-8 pt-10 pb-8 sm:grid-cols-[1fr_auto] sm:items-center sm:pt-16">
        <div>
          <p className="font-tech text-xs text-primary uppercase tracking-[0.16em]">
            Website reference · English
          </p>
          <h1 className="mt-4 text-balance font-display text-4xl font-bold tracking-tight sm:text-5xl">
            ConPaws design system
          </h1>
          <p className="mt-5 max-w-[60ch] text-base text-muted-foreground leading-relaxed sm:text-lg">
            Quiet surfaces. Clear actions. One familiar brand, with room for
            each platform to feel at home.
          </p>
        </div>
        <CompassPaw
          aria-hidden="true"
          className="hidden size-20 text-primary sm:block"
        />
      </header>

      <nav
        aria-label="On this page"
        className="mb-8 flex flex-wrap gap-x-5 gap-y-1"
      >
        {sections.map(([id, label]) => (
          <a
            key={id}
            href={`#${id}`}
            className="inline-flex min-h-11 items-center text-sm text-muted-foreground underline-offset-4 transition-colors hover:text-primary hover:underline motion-reduce:transition-none"
          >
            {label}
          </a>
        ))}
      </nav>

      <ReferenceSection
        id="brand"
        title="Brand assets & basic rules"
        description="Use the official ConPaws artwork already shipped with the app and website. Keep the artwork intact, give it room, and choose a background with clear contrast."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <h3 className="font-display text-lg font-semibold">
                Official compass-and-paw mark
              </h3>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex min-h-40 items-center justify-center gap-5 rounded-xl border border-border bg-background p-6">
                <div className="flex size-24 items-center justify-center rounded-2xl bg-[#091533]">
                  <CompassPaw className="size-16 text-[#0faced]" />
                </div>
                <div className="flex size-24 items-center justify-center rounded-2xl bg-[#0faced]">
                  <CompassPaw className="size-16 text-[#041f2e]" />
                </div>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                The mark is shared from the app icon and rendered from the
                canonical SVG path. Use it as supplied; do not stretch, crop,
                rotate or add effects.
              </p>
              <a
                href="/icon.svg"
                download="conpaws-mark.svg"
                className={buttonVariants({ variant: "outline" })}
              >
                Download SVG mark
              </a>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <h3 className="font-display text-lg font-semibold">
                Wordmark & app icon
              </h3>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex min-h-40 flex-col items-center justify-center gap-3 rounded-xl border border-border bg-[#091533] p-6 text-white">
                <CompassPaw className="size-16 text-[#0faced]" />
                <span className="font-display text-2xl font-bold tracking-tight">
                  ConPaws
                </span>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                The app icon uses the same mark on the platform-provided icon
                background. Pair the mark with the ConPaws wordmark in headings
                and navigation; keep clear space around the complete lockup.
              </p>
              <a
                href="/app-icon.png"
                download="conpaws-app-icon.png"
                className={buttonVariants({ variant: "outline" })}
              >
                Download app icon
              </a>
            </CardContent>
          </Card>
        </div>
        <ul className="mt-5 grid gap-3 text-sm text-muted-foreground leading-relaxed sm:grid-cols-2">
          <li className="rounded-lg border border-border p-4">
            <strong className="text-foreground">Clear space:</strong> leave at
            least one paw-mark width between the artwork and nearby content.
          </li>
          <li className="rounded-lg border border-border p-4">
            <strong className="text-foreground">Small sizes:</strong> use the
            icon asset for app icons; use the SVG mark for web. Check that the
            paw and compass details remain legible.
          </li>
          <li className="rounded-lg border border-border p-4">
            <strong className="text-foreground">Color:</strong> use cyan as an
            accent with the paired dark foreground on fills. Keep body copy on
            readable neutral surfaces.
          </li>
          <li className="rounded-lg border border-border p-4">
            <strong className="text-foreground">Avoid:</strong> recoloring,
            distorting, outlining, shadowing or placing the mark over busy
            imagery.
          </li>
        </ul>
        <p className="mt-5 text-sm text-muted-foreground leading-relaxed">
          ConPaws brand assets are provided for identifying this app and its
          official website. Do not imply endorsement or alter the mark. Contact
          MrDemonWolf, Inc. for permission to use the artwork outside that
          context.
        </p>
      </ReferenceSection>

      <ReferenceSection
        id="colors"
        title="Color has a job"
        description="Black and gray surfaces keep the website calm. Cyan marks actions and focus. Each sample below uses the live CSS variables, including its paired text color."
      >
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {colorRoles.map(([label, background, foreground]) => (
            <li key={background}>
              <Card className="h-full overflow-hidden">
                <div
                  aria-hidden="true"
                  className="flex min-h-28 items-center justify-between border-b border-border px-5 py-6"
                  style={{
                    backgroundColor: `var(--${background})`,
                    color: `var(--${foreground})`,
                  }}
                >
                  <span className="font-display text-4xl font-semibold">
                    Aa
                  </span>
                  {background === "primary" && (
                    <CompassPaw className="size-9" />
                  )}
                </div>
                <CardContent className="pt-4">
                  <h3 className="font-display text-base font-semibold">
                    {label}
                  </h3>
                  <p className="mt-2 break-words font-tech text-xs text-muted-foreground leading-6">
                    <code>--{background}</code>
                    <br />
                    <code>--{foreground}</code>
                  </p>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
        <p className="mt-5 max-w-[70ch] text-sm text-muted-foreground leading-relaxed">
          Borders use <code className="font-tech">--border</code>; inputs use{" "}
          <code className="font-tech">--input</code>; focus uses{" "}
          <code className="font-tech">--ring</code>. Keep these roles separate.
          Filled actions use their paired primary foreground: light appearance
          pairs darker cyan with white text; dark appearance pairs bright cyan
          with dark text.
        </p>
        <p className="mt-3 max-w-[70ch] text-sm text-muted-foreground leading-relaxed">
          The sticky website header uses a tinted backdrop blur. It stays solid
          when the effect is unsupported, or when the browser reports reduced
          transparency, increased contrast or forced colors. Menu drawers remain
          solid.
        </p>
      </ReferenceSection>

      <ReferenceSection
        id="typography"
        title="Readable first, recognizable always"
        description="Montserrat sets headings and body copy. Roboto Mono sets times, short labels and identifiers. Use the existing font roles rather than loading another family."
      >
        <Card>
          <CardContent className="grid gap-8 pt-6 md:grid-cols-[1fr_1.2fr]">
            <div>
              <p className="font-tech text-xs text-muted-foreground">
                font-display · Montserrat
              </p>
              <p className="mt-3 font-display text-3xl font-bold tracking-tight sm:text-4xl">
                Find your next good moment.
              </p>
            </div>
            <div className="space-y-5">
              <div>
                <p className="font-tech text-xs text-muted-foreground">
                  font-sans · Montserrat
                </p>
                <p className="mt-3 text-base leading-relaxed">
                  A convention day has plenty going on. Short labels,
                  comfortable line spacing and clear headings help you find what
                  matters.
                </p>
              </div>
              <div>
                <p className="font-tech text-xs text-muted-foreground">
                  font-tech · Roboto Mono
                </p>
                <p className="mt-3 font-tech text-lg tabular-nums">
                  10:30 AM · Main Hall
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <p className="mt-5 text-sm text-muted-foreground leading-relaxed">
          Body examples use 16px text; headings scale with the layout. Keep
          technical type out of long paragraphs and let text wrap when space is
          tight.
        </p>
      </ReferenceSection>

      <ReferenceSection
        id="spacing"
        title="Space creates the hierarchy"
        description="Use the Tailwind spacing scale and the shared radius tokens. A component’s padding and shape should follow its role, not a new one-off value."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <h3 className="font-display text-lg font-semibold">
                Spacing scale
              </h3>
            </CardHeader>
            <CardContent>
              <ul className="space-y-4">
                {[1, 2, 3, 4, 6, 8].map((step) => (
                  <li key={step} className="flex items-center gap-4">
                    <code className="w-16 shrink-0 font-tech text-xs text-muted-foreground">
                      space-{step}
                    </code>
                    <span
                      aria-hidden="true"
                      className="h-3 rounded-sm bg-primary"
                      style={{ width: `calc(var(--spacing) * ${step})` }}
                    />
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <h3 className="font-display text-lg font-semibold">
                Shared radii
              </h3>
            </CardHeader>
            <CardContent>
              <ul className="grid grid-cols-2 gap-4">
                {["sm", "md", "lg", "xl"].map((radius) => (
                  <li
                    key={radius}
                    className="flex min-h-24 flex-col items-center justify-center gap-3 border border-input bg-secondary p-3"
                    style={
                      {
                        borderRadius: `var(--radius-${radius})`,
                      } as CSSProperties
                    }
                  >
                    <code className="font-tech text-xs">--radius-{radius}</code>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      </ReferenceSection>

      <ReferenceSection
        id="components"
        title="Real components, useful states"
        description="These are the website’s shared Button, Input, Badge and Card primitives. The notes button opens a local component example. Inputs below are specimens, not a signup form; nothing is submitted or saved."
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <h3 className="font-display text-lg font-semibold">
                Actions and status
              </h3>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3">
                <Button
                  popoverTarget="design-system-notes"
                  className="motion-reduce:transition-none"
                >
                  Open demo notes
                </Button>
                <a
                  href="#accessibility"
                  className={buttonVariants({
                    variant: "outline",
                    className: "motion-reduce:transition-none",
                  })}
                >
                  Accessibility guidance
                </a>
                <Button variant="secondary" disabled>
                  Disabled example
                </Button>
              </div>
              <p className="mt-5 text-sm text-muted-foreground leading-relaxed">
                Use buttons for actions and links for navigation. Default
                controls here have a minimum 44px target. Tab to them to see the
                shared focus treatment.
              </p>
              <div className="mt-6 flex flex-wrap gap-2">
                <Badge>Supporting label</Badge>
                <Badge variant="default">Primary label</Badge>
                <Badge variant="outline">Outline label</Badge>
                <Badge variant="destructive">Destructive label</Badge>
              </div>
              <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
                Badges label content; they are not buttons. Status needs words
                as well as color.
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <h3 className="font-display text-lg font-semibold">
                Fields and feedback
              </h3>
            </CardHeader>
            <CardContent className="space-y-5">
              <div>
                <label
                  htmlFor="design-system-title"
                  className="mb-2 block text-sm font-medium"
                >
                  Event title · editable example
                </label>
                <Input
                  id="design-system-title"
                  defaultValue="Fursuit group photo"
                  autoComplete="off"
                  aria-describedby="design-system-title-hint"
                  className="motion-reduce:transition-none"
                />
                <p
                  id="design-system-title-hint"
                  className="mt-2 text-sm text-muted-foreground"
                >
                  Try editing this sample. It is not saved or sent.
                </p>
              </div>
              <div>
                <label
                  htmlFor="design-system-invalid"
                  className="mb-2 block text-sm font-medium"
                >
                  Time zone · error example
                </label>
                <Input
                  id="design-system-invalid"
                  defaultValue="Not a time zone"
                  readOnly
                  aria-invalid="true"
                  aria-describedby="design-system-error"
                  className="border-destructive motion-reduce:transition-none"
                />
                <p
                  id="design-system-error"
                  className="mt-2 text-sm text-destructive"
                >
                  Example error: choose a valid time zone, such as
                  America/Chicago.
                </p>
              </div>
              <div>
                <label
                  htmlFor="design-system-disabled"
                  className="mb-2 block text-sm font-medium"
                >
                  Unavailable field · disabled example
                </label>
                <Input
                  id="design-system-disabled"
                  placeholder="Unavailable"
                  disabled
                />
              </div>
            </CardContent>
          </Card>
        </div>
        <div
          id="design-system-notes"
          popover="auto"
          role="dialog"
          aria-labelledby="design-system-notes-title"
          className={styles.notes}
        >
          <h3
            id="design-system-notes-title"
            className="font-display text-xl font-bold"
          >
            Component demo only
          </h3>
          <p className="mt-3 text-base text-muted-foreground leading-relaxed">
            This native browser popover opens without an account or a network
            request. Press Escape, click outside, or use Close notes.
          </p>
          <Button
            popoverTarget="design-system-notes"
            popoverTargetAction="hide"
            variant="secondary"
            className="mt-6 motion-reduce:transition-none"
          >
            Close notes
          </Button>
        </div>
      </ReferenceSection>

      <ReferenceSection
        id="accessibility"
        title="Clarity includes access"
        description="Accessibility belongs in every component state. A color, hover effect or gesture cannot be the only way to understand or use an action."
      >
        <ul className="grid gap-x-10 gap-y-5 text-base leading-relaxed md:grid-cols-2">
          <li>
            <strong>Visible names and feedback.</strong> Label fields, describe
            errors beside them and connect the explanation with{" "}
            <code className="font-tech text-sm">aria-describedby</code>. Give
            icon-only actions an accessible name.
          </li>
          <li>
            <strong>Keyboard and touch.</strong> Preserve visible focus,
            sensible Tab order and a visible path alongside gestures. Keep
            primary web controls at least 44px tall.
          </li>
          <li>
            <strong>Text and contrast.</strong> Use paired foreground and
            background roles. Keep text usable when zoomed; do not hide meaning
            behind fixed heights or clipped labels.
          </li>
          <li>
            <strong>Respect reduced motion.</strong> Keep content and controls
            usable without animation. These examples are static, and their
            transitions stop when reduced motion is requested.
          </li>
        </ul>
      </ReferenceSection>

      <ReferenceSection
        id="native"
        title="A shared brand, native behavior"
        description="The website palette is not a replacement for the mobile app’s platform contracts. Native controls and semantic colors remain separate from these HTML examples."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <h3 className="font-display text-lg font-semibold">iOS</h3>
            </CardHeader>
            <CardContent>
              <p className="text-base text-muted-foreground leading-relaxed">
                Use semantic system backgrounds and label colors, native menus
                and toolbars, and Dynamic Type. Retain accessible names and 44pt
                targets; do not replace native behavior with web styling.
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <h3 className="font-display text-lg font-semibold">Android</h3>
            </CardHeader>
            <CardContent>
              <p className="text-base text-muted-foreground leading-relaxed">
                Use the same seeded Material palette across React Native
                surfaces, navigation and Compose controls. Retain native menus,
                48dp targets and layouts that work with larger system text.
              </p>
            </CardContent>
          </Card>
        </div>
        <p className="mt-5 max-w-[72ch] text-sm text-muted-foreground leading-relaxed">
          Mobile interaction redesigns remain proposals awaiting review. This
          page documents the website and the existing native contract; a browser
          preview does not prove native rendering, accessibility or device
          behavior.
        </p>
      </ReferenceSection>
    </PageShell>
  );
}
