import CalendarAddIcon from "@expo/material-symbols/calendar_add_on.xml";
import CheckIcon from "@expo/material-symbols/check.xml";
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
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useColorScheme, useWindowDimensions, View } from "react-native";
import { EmptyState } from "@/components/ui";
import { developerToolsEnabled } from "@/lib/developer-tools";

const CHECK_ICON = Icon.select({ ios: "checkmark", android: CheckIcon });
const CHEVRON_ICON = Icon.select({
  ios: "chevron.right",
  android: ChevronRightIcon,
});
const EMPTY_STATE_ICON = Icon.select({
  ios: "calendar.badge.plus",
  android: CalendarAddIcon,
});
const FORM_ICON = Icon.select({ ios: "square.and.pencil", android: FormsIcon });

const APPEARANCE_OPTIONS = ["system", "light", "dark"] as const;

type PreviewAppearance = (typeof APPEARANCE_OPTIONS)[number];
type SheetPreview = "empty" | "form" | null;

function NavigationIndicator() {
  return <Icon name={CHEVRON_ICON} size={15} />;
}

export default function UiSystemScreen() {
  const { t } = useTranslation();
  const systemColorScheme = useColorScheme();
  const { fontScale, width } = useWindowDimensions();
  const [appearance, setAppearance] = useState<PreviewAppearance>("system");
  const [switchValue, setSwitchValue] = useState(true);
  const [sheetPreview, setSheetPreview] = useState<SheetPreview>(null);
  const enabled = developerToolsEnabled(
    __DEV__,
    Constants.expoConfig?.extra?.appVariant,
  );
  const systemAppearance = systemColorScheme === "dark" ? "dark" : "light";
  const previewAppearance =
    appearance === "system" ? systemAppearance : appearance;
  const sheetContentWidth = Math.max(280, width - 32);

  if (!enabled) return <Redirect href="/(tabs)/settings" />;

  return (
    <Host
      colorScheme={previewAppearance}
      seedColor={previewAppearance === "dark" ? "#18B7F2" : "#006F91"}
      style={{ flex: 1 }}
      useViewportSizeMeasurement
    >
      <FieldGroup>
        <FieldGroup.Section title="Appearance">
          {APPEARANCE_OPTIONS.map((option) => (
            <ListItem
              key={option}
              supportingText={
                option === "system"
                  ? `Currently ${systemAppearance}`
                  : `Preview the ${option} system surface`
              }
              trailing={
                appearance === option ? (
                  <Icon name={CHECK_ICON} size={17} />
                ) : undefined
              }
              onPress={() => setAppearance(option)}
            >
              {option[0].toUpperCase() + option.slice(1)}
            </ListItem>
          ))}
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
        </FieldGroup.Section>

        <FieldGroup.Section title="Accessibility type">
          <ListItem supportingText={`${fontScale.toFixed(2)}× system scale`}>
            Dynamic Type
          </ListItem>
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

      <BottomSheet
        isPresented={sheetPreview !== null}
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
    </Host>
  );
}
