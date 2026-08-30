import CalendarAddIcon from "@expo/material-symbols/calendar_add_on.xml";
import ChevronRightIcon from "@expo/material-symbols/chevron_right.xml";
import FormsIcon from "@expo/material-symbols/forms_add_on.xml";
import {
  BottomSheet,
  FieldGroup,
  Host,
  Icon,
  ListItem,
  Button as NativeButton,
  Switch as NativeSwitch,
  Text as NativeText,
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
import { useResolvedColorScheme } from "@/hooks/useResolvedColorScheme";
import {
  getAppearancePreference,
  subscribeAppearancePreference,
} from "@/lib/appearance-storage";
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
  | "skeleton"
  | "surfaces"
  | null;

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
        </FieldGroup.Section>

        <FieldGroup.Section title="Accessibility type">
          <ListItem supportingText="Large title · accessibility scalable">
            <NativeText
              textStyle={{ fontSize: 34, fontWeight: "700" }}
              modifiers={[font({ textStyle: "largeTitle", weight: "bold" })]}
            >
              Heading 1
            </NativeText>
          </ListItem>
          <ListItem supportingText="Body · accessibility scalable">
            <NativeText
              textStyle={{ fontSize: 17 }}
              modifiers={[font({ textStyle: "body" })]}
            >
              Body text
            </NativeText>
          </ListItem>
          <ListItem supportingText="Caption · accessibility scalable">
            <NativeText
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
