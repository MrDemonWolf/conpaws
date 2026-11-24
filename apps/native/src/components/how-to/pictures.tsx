import { CalendarPlus, Check, FileText, Link } from "lucide-react-native";
import type { ReactElement } from "react";
import { useTranslation } from "react-i18next";
import { useWindowDimensions, View } from "react-native";
import { CatalogEditionRow, CatalogFallbackCard } from "@/components/catalog";
import { Badge, Button, Card, Input, Text } from "@/components/ui";
import { buildConPawsPreviewFixture } from "@/fixtures/conpaws-preview";
import { useResolvedColorScheme } from "@/hooks/useResolvedColorScheme";
import { catalogEditionSummary } from "@/lib/catalog/adapter";
import { buildFixtureCatalog } from "@/lib/catalog/fixture-source";
import { formatConventionDate, formatEventTime } from "@/lib/event-time-format";
import type { HowToPictureId } from "@/lib/how-to";
import { currentLocale } from "@/lib/i18n";
import { STACKED_FONT_SCALE } from "@/lib/text-scale";
import { themeTokens } from "@/lib/theme-tokens";
import {
  MockRow,
  MockupFrame,
  type MockupSurface,
  Spotlight,
} from "./MockupFrame";

/**
 * The pictures beside each "Show me how" card and step: simplified mockups of
 * the real screens, drawn from the app's shared components. The catalog ones
 * use the real Find components; the import ones approximate a SwiftUI Form or
 * Compose list, which a React Native picture can only imitate.
 *
 * Everything here is decorative (see MockupFrame). Sample names, event titles
 * and the addresses below are sample data and stay untranslated, as onboarding
 * does; nothing is a link and nothing is fetched.
 */

type Density = "full" | "focus";

interface PictureProps {
  surface: MockupSurface;
  /**
   * `focus` from the first accessibility text size: only the ringed part, so
   * the picture never outgrows the instructions it illustrates.
   */
  density: Density;
}

const SCHED_HOST = "previewcon.sched.com";
const SCHED_URL = "https://previewcon.sched.com";
const WEBCAL_URL = "webcal://previewcon.example/schedule.ics";
const ICS_FILE = "previewcon.ics";
const SEARCH_TEXT = "Lakeside";

// Pretend controls need callbacks but must never act.
const noop = () => {};

const preview = buildConPawsPreviewFixture();
const timeZone = preview.convention.timeZone ?? "UTC";
const edition = buildFixtureCatalog()[0];
if (!edition) throw new Error("The how-to pictures need a sample edition.");
const sampleEvents = preview.events.slice(0, 2);
const eventCount = preview.events.length;

/** The two categories most of the sample programme falls under. */
const topCategories = (() => {
  const counts = new Map<string, number>();
  for (const event of preview.events) {
    if (event.category)
      counts.set(event.category, (counts.get(event.category) ?? 0) + 1);
  }
  return [...counts]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([name, count]) => ({ name, count }));
})();

function useIconColors() {
  const tokens = themeTokens[useResolvedColorScheme()];
  return { primary: tokens.primary, muted: tokens.mutedForeground };
}

function CatalogSearchPicture({ surface, density }: PictureProps) {
  const { t } = useTranslation();
  const locale = currentLocale();
  const field = (
    <View className="mx-4">
      <Spotlight>
        <Input
          value={SEARCH_TEXT}
          placeholder={t("catalog.searchPlaceholder")}
          editable={false}
          focusable={false}
        />
      </Spotlight>
    </View>
  );
  if (density === "focus") {
    return <MockupFrame surface={surface}>{field}</MockupFrame>;
  }
  const summary = catalogEditionSummary(edition, new Date());

  return (
    <MockupFrame surface={surface} caption={t("catalog.title")}>
      {field}
      <CatalogEditionRow
        edition={edition}
        dateRange={t("home.dateRange", {
          start: formatConventionDate(edition.startsOn, locale),
          end: formatConventionDate(edition.endsOn, locale),
        })}
        scheduleReady={summary.scheduleReady}
        scheduleReadyLabel={t("catalog.scheduleReady")}
        scheduleNotYetLabel={t("catalog.scheduleNotYet")}
        onPress={noop}
        focusable={false}
      />
    </MockupFrame>
  );
}

/** One fact of the Find detail card: a caption over a value. */
function Fact({ label, value }: { label: string; value: string }) {
  return (
    <View>
      <Text variant="caption" className="text-muted-foreground">
        {label}
      </Text>
      <Text variant="body">{value}</Text>
    </View>
  );
}

function CatalogDetailPicture({ surface, density }: PictureProps) {
  const { t } = useTranslation();
  const locale = currentLocale();
  const schedule = (
    <Spotlight>
      <Fact
        label={t("catalog.confirm.schedule")}
        value={t("catalog.confirm.scheduleReady", {
          count: edition.sessions.length,
        })}
      />
    </Spotlight>
  );
  if (density === "focus") {
    return (
      <MockupFrame surface={surface}>
        <Card className="mx-4 gap-3">{schedule}</Card>
      </MockupFrame>
    );
  }

  return (
    <MockupFrame surface={surface} caption={edition.name}>
      {/* The facts card of find/[slug].tsx, without its time zone row. */}
      <Card className="mx-4 gap-3">
        <Fact
          label={t("catalog.confirm.dates")}
          value={t("home.dateRange", {
            start: formatConventionDate(edition.startsOn, locale),
            end: formatConventionDate(edition.endsOn, locale),
          })}
        />
        <View className="h-px bg-border" />
        <Fact label={t("catalog.confirm.venue")} value={edition.venue} />
        <View className="h-px bg-border" />
        {schedule}
      </Card>
    </MockupFrame>
  );
}

function CatalogDownloadPicture({ surface, density }: PictureProps) {
  const { t } = useTranslation();

  return (
    <MockupFrame surface={surface}>
      <View className="mx-4">
        <Spotlight>
          <Button focusable={false}>{t("catalog.confirm.download")}</Button>
        </Spotlight>
      </View>
      {density === "full" ? (
        <Text variant="caption" className="px-4 text-center">
          {t("catalog.confirm.offlineAvailable")}
        </Text>
      ) : null}
    </MockupFrame>
  );
}

function CatalogNotListedPicture({ surface }: PictureProps) {
  const { t } = useTranslation();

  // No ring: the card carries its own outer margin, and it is already the
  // whole picture. That margin is `mt-4` on top only, so the same space goes
  // underneath to keep the card centred in the frame.
  return (
    <MockupFrame surface={surface}>
      <View className="pb-4">
        <CatalogFallbackCard
          title={t("catalog.notListed.title")}
          body={t("catalog.notListed.body")}
          importLabel={t("catalog.notListed.import")}
          createLabel={t("catalog.notListed.create")}
          onImport={noop}
          onCreate={noop}
          focusable={false}
        />
      </View>
    </MockupFrame>
  );
}

function SchedSitePicture({ surface, density }: PictureProps) {
  const locale = currentLocale();
  const address = (
    <View className="mx-4 flex-row">
      <Spotlight pill>
        <Badge variant="neutral" label={SCHED_HOST} />
      </Spotlight>
    </View>
  );
  if (density === "focus") {
    return <MockupFrame surface={surface}>{address}</MockupFrame>;
  }

  return (
    <MockupFrame surface={surface}>
      {address}
      <Text variant="label" className="px-4">
        {preview.convention.name}
      </Text>
      {sampleEvents.map((event) => (
        <Text key={event.id} variant="caption" className="px-4">
          {`${formatEventTime(event.startTime, timeZone, locale)} · ${event.title}`}
        </Text>
      ))}
    </MockupFrame>
  );
}

function SchedCopyPicture({ surface, density }: PictureProps) {
  const { t } = useTranslation();

  return (
    <MockupFrame surface={surface}>
      {/* items-start lets the ring hug the badges and still wrap them. */}
      <View className="mx-4 items-start">
        <Spotlight>
          <View className="flex-row flex-wrap gap-2">
            <Badge variant="neutral" label={SCHED_HOST} />
            <Badge variant="info" label={t("howTo.mock.copy")} />
          </View>
        </Spotlight>
      </View>
      {density === "full" ? (
        <Text variant="caption" className="px-4">
          {preview.convention.name}
        </Text>
      ) : null}
    </MockupFrame>
  );
}

function ImportLinkPicture({ surface, density }: PictureProps) {
  const { t } = useTranslation();
  const link = (
    <View className="mx-4">
      <Spotlight>
        <View className="gap-2">
          <Input value={SCHED_URL} editable={false} focusable={false} />
          <Button focusable={false}>{t("import.fetchSchedule")}</Button>
        </View>
      </Spotlight>
    </View>
  );
  if (density === "focus") {
    return <MockupFrame surface={surface}>{link}</MockupFrame>;
  }

  return (
    <MockupFrame surface={surface} caption={t("import.title")}>
      <MockRow title={t("import.url")} />
      {link}
    </MockupFrame>
  );
}

function ImportReviewPicture({
  surface,
  density,
  source,
}: PictureProps & { source: "sched" | "generic" }) {
  const { t } = useTranslation();
  const colors = useIconColors();
  const importButton = (
    <View className="mx-4">
      <Spotlight>
        <Button focusable={false}>
          {t(eventCount === 1 ? "import.importEvent" : "import.importEvents", {
            count: eventCount,
          })}
        </Button>
      </Spotlight>
    </View>
  );
  if (density === "focus") {
    return <MockupFrame surface={surface}>{importButton}</MockupFrame>;
  }

  return (
    <MockupFrame surface={surface} caption={t("import.title")}>
      <MockRow
        title={preview.convention.name}
        detail={`${t(
          eventCount === 1 ? "import.eventFound" : "import.eventsFound",
          { count: eventCount },
        )} · ${t(
          source === "sched"
            ? "import.feedSource.sched"
            : "import.feedSource.generic",
        )}`}
      />
      {topCategories.map(({ name, count }) => (
        <MockRow
          key={name}
          title={t(
            count === 1 ? "import.categoryEvent" : "import.categoryEvents",
            { name, count },
          )}
          trailing={<Check size={18} color={colors.primary} />}
        />
      ))}
      {importButton}
    </MockupFrame>
  );
}

function ImportReviewSchedPicture(props: PictureProps) {
  return <ImportReviewPicture {...props} source="sched" />;
}

function ImportReviewFilePicture(props: PictureProps) {
  return <ImportReviewPicture {...props} source="generic" />;
}

function WebsiteCalendarLinkPicture({ surface, density }: PictureProps) {
  const { t } = useTranslation();
  const colors = useIconColors();
  const link = (
    <View className="mx-4">
      <Spotlight>
        <MockRow
          leading={<CalendarPlus size={18} color={colors.primary} />}
          title={t("howTo.mock.addToCalendar")}
          titleClassName="text-primary"
        />
      </Spotlight>
    </View>
  );
  if (density === "focus") {
    return <MockupFrame surface={surface}>{link}</MockupFrame>;
  }

  return (
    <MockupFrame surface={surface}>
      <Text variant="label" className="px-4">
        {preview.convention.name}
      </Text>
      <Text variant="caption" className="px-4">
        {t("catalog.confirm.schedule")}
      </Text>
      {link}
    </MockupFrame>
  );
}

function LinkOrFilePicture({ surface, density }: PictureProps) {
  const colors = useIconColors();

  return (
    <MockupFrame surface={surface}>
      <View className="mx-4">
        <Spotlight>
          <MockRow
            leading={<Link size={18} color={colors.primary} />}
            title={WEBCAL_URL}
            singleLine
          />
        </Spotlight>
      </View>
      {density === "full" ? (
        <MockRow
          leading={<FileText size={18} color={colors.muted} />}
          title={ICS_FILE}
        />
      ) : null}
    </MockupFrame>
  );
}

function ImportIcsPicture({ surface, density }: PictureProps) {
  const { t } = useTranslation();
  const chooseFile = (
    <View className="mx-4">
      <Spotlight>
        <Button variant="outline" focusable={false}>
          {t("import.chooseFile")}
        </Button>
      </Spotlight>
    </View>
  );
  const link = (
    <View className="mx-4">
      <Spotlight>
        <Input value={WEBCAL_URL} editable={false} focusable={false} />
      </Spotlight>
    </View>
  );
  if (density === "focus") {
    // Each ring reaches 4 points past its control and the frame's gap-2 is
    // only 7, so with no row between them the two rings would overlap. The
    // wider gap keeps them two separate rings.
    return (
      <MockupFrame surface={surface}>
        <View className="gap-4">
          {chooseFile}
          {link}
        </View>
      </MockupFrame>
    );
  }

  // Two rings, in the order the real screen shows the two sources.
  return (
    <MockupFrame surface={surface} caption={t("import.title")}>
      <MockRow title={t("import.file")} detail={t("import.fileDescription")} />
      {chooseFile}
      <MockRow title={t("import.url")} />
      {link}
    </MockupFrame>
  );
}

/**
 * Typed by id, so `check-types` fails when a step names a picture that has no
 * drawing.
 */
const PICTURES: Record<HowToPictureId, (props: PictureProps) => ReactElement> =
  {
    "catalog-search": CatalogSearchPicture,
    "catalog-detail": CatalogDetailPicture,
    "catalog-download": CatalogDownloadPicture,
    "catalog-not-listed": CatalogNotListedPicture,
    "sched-site": SchedSitePicture,
    "sched-copy": SchedCopyPicture,
    "import-link": ImportLinkPicture,
    "import-review-sched": ImportReviewSchedPicture,
    "website-calendar-link": WebsiteCalendarLinkPicture,
    "link-or-file": LinkOrFilePicture,
    "import-ics": ImportIcsPicture,
    "import-review-file": ImportReviewFilePicture,
  };

export function HowToPicture({
  id,
  surface,
}: {
  id: HowToPictureId;
  surface: MockupSurface;
}) {
  const { fontScale } = useWindowDimensions();
  const density: Density = fontScale >= STACKED_FONT_SCALE ? "focus" : "full";
  const Picture = PICTURES[id];
  return <Picture surface={surface} density={density} />;
}
