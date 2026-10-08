import CalendarAddIcon from "@expo/material-symbols/calendar_add_on.xml";
import ChevronRightIcon from "@expo/material-symbols/chevron_right.xml";
import FormsIcon from "@expo/material-symbols/forms_add_on.xml";
import {
  BottomSheet,
  FieldGroup,
  Host,
  Icon,
  Button as NativeButton,
  Switch as NativeSwitch,
  TextInput as NativeTextInput,
  RNHostView,
  Row,
} from "@expo/ui";
import { font } from "@expo/ui/swift-ui/modifiers";
import Constants from "expo-constants";
import { Redirect } from "expo-router";
import { useTheme } from "expo-router/react-navigation";
import { useState, useSyncExternalStore } from "react";
import { useTranslation } from "react-i18next";
import { useWindowDimensions, View } from "react-native";
// See components/ui/FieldRow.android.tsx — one Material surface per row.
import { AgendaGapRow } from "@/components/schedule/AgendaGapRow";
import { AgendaRow } from "@/components/schedule/AgendaRow";
import { BrowseSummaryHeader } from "@/components/schedule/BrowseSummaryHeader";
import { CompareCard } from "@/components/schedule/CompareCard";
import { DayStrip, type DayStripDay } from "@/components/schedule/DayStrip";
import { DropInRow } from "@/components/schedule/DropInRow";
import { NowHeroCard } from "@/components/schedule/NowHeroCard";
import {
  TimeChipRow,
  type TimeChipSlot,
} from "@/components/schedule/TimeChipRow";
import {
  Badge,
  type BadgeVariant,
  Banner,
  Button,
  Card,
  ConventionListSkeleton,
  EmptyState,
  Input,
  Row as ListRow,
  ScheduleSkeleton,
  Text,
} from "@/components/ui";
import { FieldRow as ListItem } from "@/components/ui/FieldRow";
import { NativeText } from "@/components/ui/NativeText";
import { useResolvedColorScheme } from "@/hooks/useResolvedColorScheme";
import {
  getAppearancePreference,
  subscribeAppearancePreference,
} from "@/lib/appearance-storage";
import { categoryAccentColor } from "@/lib/category-color";
import { developerToolsEnabled } from "@/lib/developer-tools";

const CHEVRON_ICON = Icon.select({
  ios: "chevron.right",
  android: ChevronRightIcon,
});
const EMPTY_STATE_ICON = Icon.select({
  ios: "calendar.badge.plus",
  android: CalendarAddIcon,
});
const FORM_ICON = Icon.select({ ios: "square.and.pencil", android: FormsIcon });
const SKELETON_ICON = Icon.select({
  ios: "rectangle.on.rectangle",
  android: FormsIcon,
});
const BANNER_ICON = Icon.select({
  ios: "exclamationmark.bubble",
  android: FormsIcon,
});

const BADGE_VARIANTS: BadgeVariant[] = [
  "upcoming",
  "active",
  "ended",
  "info",
  "neutral",
  "age-teen",
  "age-mature",
  "age-adult",
];

type SheetPreview =
  | "banners"
  | "buttons"
  | "empty"
  | "fields"
  | "form"
  | "hero"
  | "schedule"
  | "skeleton"
  | "surfaces"
  | null;

// Sample data for the schedule previews. Fictional, like every fixture here.
const GALLERY_DAYS: readonly DayStripDay[] = [
  {
    key: "wed",
    weekday: "Wed",
    dayNumber: "7",
    count: 67,
    accessibilityLabel: "Wednesday, October 7, 67 panels",
  },
  {
    key: "thu",
    weekday: "Thu",
    dayNumber: "8",
    count: 58,
    accessibilityLabel: "Thursday, October 8, 58 panels",
  },
  {
    key: "fri",
    weekday: "Fri",
    dayNumber: "9",
    count: 39,
    accessibilityLabel: "Friday, October 9, 39 panels",
  },
];
const GALLERY_SLOTS: readonly TimeChipSlot[] = [
  {
    startMs: 1,
    label: "2 PM",
    accessibilityLabel: "Panels between 2 PM and 3 PM",
  },
  {
    startMs: 2,
    label: "3 PM",
    accessibilityLabel: "Panels between 3 PM and 4 PM",
  },
  {
    startMs: 3,
    label: "4 PM",
    accessibilityLabel: "Panels between 4 PM and 5 PM",
  },
];

function NavigationIndicator() {
  return <Icon name={CHEVRON_ICON} size={15} />;
}

export default function UiSystemScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const appearancePreference = useSyncExternalStore(
    subscribeAppearancePreference,
    getAppearancePreference,
    getAppearancePreference,
  );
  const { fontScale, width } = useWindowDimensions();
  const [switchValue, setSwitchValue] = useState(true);
  const [sheetPreview, setSheetPreview] = useState<SheetPreview>(null);
  const [galleryDay, setGalleryDay] = useState("thu");
  const [gallerySlot, setGallerySlot] = useState<number | null>(null);
  const enabled = developerToolsEnabled(
    __DEV__,
    Constants.expoConfig?.extra?.appVariant,
  );
  const systemAppearance = useResolvedColorScheme();
  const sheetContentWidth = Math.max(280, width - 32);

  if (!enabled) return <Redirect href="/(tabs)/settings" />;

  return (
    <Host
      colorScheme={systemAppearance}
      seedColor={colors.primary}
      style={{ flex: 1 }}
      useViewportSizeMeasurement
    >
      <FieldGroup>
        <FieldGroup.Section title="Environment">
          <ListItem
            supportingText={`${appearancePreference} · renders ${systemAppearance}`}
          >
            Appearance
          </ListItem>
          <ListItem supportingText={`${fontScale.toFixed(2)}x system scale`}>
            Dynamic Type
          </ListItem>
        </FieldGroup.Section>

        <FieldGroup.Section title="Native controls">
          <NativeSwitch
            label={t("settings.app.notifications")}
            value={switchValue}
            onValueChange={setSwitchValue}
          />
          <NativeTextInput
            placeholder={t("convention.namePlaceholder")}
            returnKeyType="done"
          />
          <Row alignment="center" spacing={10}>
            <NativeButton label={t("common.save")} onPress={() => undefined} />
            <NativeButton
              label={t("common.cancel")}
              variant="outlined"
              onPress={() => undefined}
            />
            <NativeButton
              label={t("common.learnMore")}
              variant="text"
              onPress={() => undefined}
            />
          </Row>
          <NativeButton label="Disabled" disabled onPress={() => undefined} />
        </FieldGroup.Section>

        <FieldGroup.Section title="Patterns">
          <ListItem
            leading={<Icon name={EMPTY_STATE_ICON} size={22} />}
            supportingText={t("home.empty.subtitle")}
            trailing={<NavigationIndicator />}
            onPress={() => setSheetPreview("empty")}
          >
            {t("home.empty.title")}
          </ListItem>
          <ListItem
            leading={<Icon name={FORM_ICON} size={22} />}
            supportingText={t("onboarding.getStarted.importSchedule")}
            trailing={<NavigationIndicator />}
            onPress={() => setSheetPreview("form")}
          >
            {t("convention.new")}
          </ListItem>
          <ListItem
            leading={<Icon name={FORM_ICON} size={22} />}
            supportingText="Themed text field, with label and error states"
            trailing={<NavigationIndicator />}
            onPress={() => setSheetPreview("fields")}
          >
            Input
          </ListItem>
          <ListItem
            leading={<Icon name={SKELETON_ICON} size={22} />}
            supportingText="Placeholders shown while a screen loads"
            trailing={<NavigationIndicator />}
            onPress={() => setSheetPreview("skeleton")}
          >
            Loading skeletons
          </ListItem>
          <ListItem
            leading={<Icon name={BANNER_ICON} size={22} />}
            supportingText="Both tones, with and without title, action, dismiss"
            trailing={<NavigationIndicator />}
            onPress={() => setSheetPreview("banners")}
          >
            Banners
          </ListItem>
          <ListItem
            leading={<Icon name={FORM_ICON} size={22} />}
            supportingText="Every variant and size, including disabled and loading"
            trailing={<NavigationIndicator />}
            onPress={() => setSheetPreview("buttons")}
          >
            Buttons and badges
          </ListItem>
          <ListItem
            leading={<Icon name={SKELETON_ICON} size={22} />}
            supportingText="The shared card surface and tappable list row"
            trailing={<NavigationIndicator />}
            onPress={() => setSheetPreview("surfaces")}
          >
            Cards and rows
          </ListItem>
          <ListItem
            leading={<Icon name={SKELETON_ICON} size={22} />}
            supportingText="Day strip, time chips, agenda rows, gaps and drop-ins"
            trailing={<NavigationIndicator />}
            onPress={() => setSheetPreview("schedule")}
          >
            Schedule rows
          </ListItem>
          <ListItem
            leading={<Icon name={SKELETON_ICON} size={22} />}
            supportingText="The Now hero and a compare card"
            trailing={<NavigationIndicator />}
            onPress={() => setSheetPreview("hero")}
          >
            Now and compare
          </ListItem>
        </FieldGroup.Section>

        <FieldGroup.Section title="Accessibility type">
          <ListItem supportingText="Large title · accessibility scalable">
            <NativeText
              tone="foreground"
              textStyle={{ fontSize: 34, fontWeight: "700" }}
              modifiers={[font({ textStyle: "largeTitle", weight: "bold" })]}
            >
              Heading 1
            </NativeText>
          </ListItem>
          <ListItem supportingText="Body · accessibility scalable">
            <NativeText
              tone="foreground"
              textStyle={{ fontSize: 17 }}
              modifiers={[font({ textStyle: "body" })]}
            >
              Body text
            </NativeText>
          </ListItem>
          <ListItem supportingText="Caption · accessibility scalable">
            <NativeText
              tone="foreground"
              textStyle={{ fontSize: 12 }}
              modifiers={[font({ textStyle: "caption" })]}
            >
              Caption text
            </NativeText>
          </ListItem>
        </FieldGroup.Section>
      </FieldGroup>

      {/* Mounted only while presented: an always-mounted BottomSheet sibling
          leaves its anchor view over the Form and the page stops scrolling.
          onDismiss fires after the close animation, so unmounting here does
          not cut the dismissal short. */}
      {sheetPreview !== null ? (
        <BottomSheet
          isPresented
          onDismiss={() => setSheetPreview(null)}
          snapPoints={["half", "full"]}
        >
          {sheetPreview === "empty" ? (
            <RNHostView matchContents>
              <View
                className="h-[360px] bg-background"
                style={{ width: sheetContentWidth }}
              >
                <EmptyState
                  icon={EMPTY_STATE_ICON}
                  title={t("home.empty.title")}
                  subtitle={t("home.empty.subtitle")}
                  ctaLabel={t("home.empty.cta")}
                  onCta={() => undefined}
                  secondaryCtaLabel={t("convention.import")}
                  onSecondaryCta={() => undefined}
                />
              </View>
            </RNHostView>
          ) : sheetPreview === "skeleton" ? (
            <RNHostView matchContents>
              <View
                // Both skeletons carry their own "loading" live region, which is
                // right on a real screen and wrong here: nothing is loading, and
                // a screen reader would announce it twice for a static sample.
                // The gallery row that opened this sheet already named it.
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
                className="h-[520px] bg-background"
                style={{ width: sheetContentWidth }}
              >
                <View className="h-[200px]">
                  <ConventionListSkeleton rows={2} />
                </View>
                <View className="h-[280px]">
                  <ScheduleSkeleton sections={1} rowsPerSection={2} />
                </View>
              </View>
            </RNHostView>
          ) : sheetPreview === "banners" ? (
            <RNHostView matchContents>
              <View
                className="gap-2 bg-background py-4"
                style={{ width: sheetContentWidth }}
              >
                <Banner
                  title="A saved panel moved"
                  body="Marked below, with the new time and room."
                  dismissLabel="Dismiss"
                  onDismiss={() => undefined}
                />
                <Banner
                  title="Reminders are paused"
                  body="Notifications are off for ConPaws."
                  actionLabel="Open Settings"
                  onAction={() => undefined}
                />
                <Banner
                  tone="info"
                  body="Tap an event to add it to My Schedule."
                  dismissLabel="Dismiss"
                  onDismiss={() => undefined}
                />
                <Banner body="Body only, no title, no controls." />
              </View>
            </RNHostView>
          ) : sheetPreview === "buttons" ? (
            <RNHostView matchContents>
              <View
                className="gap-3 bg-background p-4"
                style={{ width: sheetContentWidth }}
              >
                {(
                  [
                    "default",
                    "secondary",
                    "outline",
                    "ghost",
                    "destructive",
                  ] as const
                ).map((variant) => (
                  <Button
                    key={variant}
                    variant={variant}
                    onPress={() => undefined}
                  >
                    {variant}
                  </Button>
                ))}
                <Button size="sm" onPress={() => undefined}>
                  Small
                </Button>
                <Button size="lg" onPress={() => undefined}>
                  Large
                </Button>
                <Button disabled onPress={() => undefined}>
                  Disabled
                </Button>
                <Button loading onPress={() => undefined}>
                  Loading
                </Button>
                <View className="flex-row flex-wrap gap-2 pt-2">
                  {BADGE_VARIANTS.map((variant) => (
                    <Badge key={variant} variant={variant} label={variant} />
                  ))}
                  <Badge variant="age-adult" emphasis="strong" label="strong" />
                </View>
              </View>
            </RNHostView>
          ) : sheetPreview === "surfaces" ? (
            <RNHostView matchContents>
              <View
                className="gap-3 bg-background p-4"
                style={{ width: sheetContentWidth }}
              >
                <Card className="gap-1">
                  <Text variant="h3">Card</Text>
                  <Text variant="caption">
                    The bordered surface used for grouped content.
                  </Text>
                </Card>
                <ListRow
                  className="rounded-xl border border-border bg-card px-4"
                  onPress={() => undefined}
                  trailing={<Text className="text-primary">↗</Text>}
                >
                  <Text variant="body" className="font-semibold">
                    Standalone row
                  </Text>
                </ListRow>
                <View>
                  <ListRow
                    className="border-border border-b px-1"
                    onPress={() => undefined}
                    trailing={<Text variant="caption">Trailing</Text>}
                  >
                    <Text variant="body">Grouped row</Text>
                  </ListRow>
                  <ListRow className="px-1" onPress={() => undefined}>
                    <Text variant="body">Grouped row, last</Text>
                  </ListRow>
                </View>
              </View>
            </RNHostView>
          ) : sheetPreview === "schedule" ? (
            <RNHostView matchContents>
              <View
                className="gap-3 bg-background py-4"
                style={{ width: sheetContentWidth }}
              >
                <DayStrip
                  monthLabel="October 2026"
                  days={GALLERY_DAYS}
                  selectedKey={galleryDay}
                  allKey="all"
                  allLabel="All"
                  allCount={3}
                  allAccessibilityLabel="All days, 3 days"
                  onSelect={setGalleryDay}
                />
                <TimeChipRow
                  slots={GALLERY_SLOTS}
                  selectedStartMs={gallerySlot}
                  allTimesLabel="All times"
                  onSelect={setGallerySlot}
                />
                <BrowseSummaryHeader
                  heading="Thu · all times"
                  countLabel="12 options"
                  totalLabel="58 total"
                  hint={{ text: "Pick what catches your eye. Decide later." }}
                />
                <AgendaRow
                  title="Fursuit parade lineup"
                  startClock="2:30"
                  dayPeriod="PM"
                  untilLabel="Until 3:30 PM"
                  room="Grand Ballroom"
                  accentColor={categoryAccentColor(
                    "Fursuiting",
                    systemAppearance,
                  )}
                  status="now"
                  statusLabel="Now"
                  reminderLabel="15 min before"
                  onPress={() => undefined}
                />
                <AgendaGapRow
                  gap={{ kind: "free", minutes: 45, hint: "short" }}
                  label="45 min free · Time to get there"
                />
                <AgendaRow
                  title="Late-night art jam"
                  startClock="4:15"
                  dayPeriod="PM"
                  untilLabel="Until 5:00 PM"
                  room="Studio B"
                  accentColor={categoryAccentColor("Art", systemAppearance)}
                  status="upcoming"
                  hasConflict
                  conflictLabel="Overlaps your plan"
                  ageBadge={{ variant: "age-adult", label: "18+ Adult" }}
                  onPress={() => undefined}
                />
                <DropInRow
                  title="Artist alley"
                  summary="Thu · 10:00 AM to 6:00 PM · Expo Hall"
                  accessibilityLabel="Artist alley, Thu · 10:00 AM to 6:00 PM · Expo Hall"
                  onPress={() => undefined}
                />
              </View>
            </RNHostView>
          ) : sheetPreview === "hero" ? (
            <RNHostView matchContents>
              <View
                className="gap-3 bg-background py-4"
                style={{ width: sheetContentWidth }}
              >
                <NowHeroCard
                  eyebrow="Happening now"
                  title="Fursuit parade lineup"
                  timeLine="2:30 PM to 3:30 PM"
                  callout={{
                    label: "Until",
                    value: "3:30 PM",
                    sub: "42 min left",
                  }}
                  room="Grand Ballroom"
                  venue="Sample Convention Hall"
                  next={{
                    kicker: "Next · 4:15 PM",
                    title: "Late-night art jam",
                    meta: "Studio B · 45 min between",
                    onPress: () => undefined,
                    accessibilityLabel: "Next: Late-night art jam",
                  }}
                  primaryLabel="Set a reminder"
                  onPrimary={() => undefined}
                  onOpen={() => undefined}
                  openAccessibilityLabel="Open Fursuit parade lineup"
                />
                <CompareCard
                  title="Late-night art jam"
                  category="Art"
                  accentColor={categoryAccentColor("Art", systemAppearance)}
                  timeRange="4:15 PM to 5:00 PM"
                  room="Studio B"
                  summary="Bring a sketchbook. Supplies are provided."
                  inPlan={false}
                  inPlanLabel="In your plan"
                  selected={false}
                  overlapNote="30 min overlaps your current choice"
                  accessibilityLabel="Late-night art jam, 4:15 PM to 5:00 PM, Studio B"
                  onSelect={() => undefined}
                />
              </View>
            </RNHostView>
          ) : sheetPreview === "fields" ? (
            <RNHostView matchContents>
              <View
                className="gap-4 bg-background p-4"
                style={{ width: sheetContentWidth }}
              >
                <Input
                  label={t("convention.name")}
                  placeholder={t("convention.namePlaceholder")}
                  value=""
                  onChangeText={() => undefined}
                />
                <Input
                  label={t("convention.location")}
                  placeholder={t("convention.locationPlaceholder")}
                  value=""
                  onChangeText={() => undefined}
                  error={t("convention.nameRequired")}
                />
              </View>
            </RNHostView>
          ) : sheetPreview === "form" ? (
            <FieldGroup style={{ width: sheetContentWidth, height: 400 }}>
              <FieldGroup.Section title={t("convention.new")}>
                <NativeTextInput
                  placeholder={t("convention.namePlaceholder")}
                  returnKeyType="done"
                />
                <NativeSwitch
                  label={t("settings.app.notifications")}
                  value={switchValue}
                  onValueChange={setSwitchValue}
                />
              </FieldGroup.Section>
              <FieldGroup.Section>
                <Row alignment="center" spacing={12}>
                  <NativeButton
                    label={t("common.cancel")}
                    variant="text"
                    onPress={() => setSheetPreview(null)}
                  />
                  <NativeButton
                    label={t("common.save")}
                    onPress={() => setSheetPreview(null)}
                  />
                </Row>
              </FieldGroup.Section>
            </FieldGroup>
          ) : null}
        </BottomSheet>
      ) : null}
    </Host>
  );
}
