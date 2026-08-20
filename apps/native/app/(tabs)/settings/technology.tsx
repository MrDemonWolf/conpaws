import { FieldGroup, Host, ListItem, Text as NativeText } from "@expo/ui";
import { font } from "@expo/ui/swift-ui/modifiers";
import { useTheme } from "expo-router/react-navigation";
import { useTranslation } from "react-i18next";
import { useColorScheme } from "react-native";

const TECHNOLOGY_GROUPS = [
  {
    key: "foundation",
    tools: [
      { name: "Expo", packageName: "expo", key: "expo" },
      {
        name: "React Native",
        packageName: "react-native",
        key: "reactNative",
      },
    ],
  },
  {
    key: "interface",
    tools: [
      { name: "Expo Router", packageName: "expo-router", key: "expoRouter" },
      { name: "Expo UI", packageName: "@expo/ui", key: "expoUi" },
    ],
  },
  {
    key: "offlineData",
    tools: [
      { name: "Expo SQLite", packageName: "expo-sqlite", key: "expoSqlite" },
      { name: "Drizzle ORM", packageName: "drizzle-orm", key: "drizzle" },
      {
        name: "TanStack Query",
        packageName: "@tanstack/react-query",
        key: "tanstackQuery",
      },
    ],
  },
  {
    key: "localizationReliability",
    tools: [
      { name: "i18next", packageName: "i18next", key: "i18next" },
      {
        name: "Sentry",
        packageName: "@sentry/react-native",
        key: "sentry",
      },
    ],
  },
] as const;

export default function TechnologyScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const colorScheme = useColorScheme();

  return (
    <Host
      colorScheme={colorScheme === "dark" ? "dark" : "light"}
      seedColor={colors.primary}
      style={{ flex: 1 }}
      useViewportSizeMeasurement
    >
      <FieldGroup>
        {TECHNOLOGY_GROUPS.map((group, groupIndex) => (
          <FieldGroup.Section
            key={group.key}
            title={t(`settings.technology.${group.key}`)}
          >
            {group.tools.map((tool) => (
              <ListItem
                key={tool.packageName}
                supportingText={`${tool.packageName} · ${t(
                  `settings.technology.tools.${tool.key}`,
                )}`}
              >
                {tool.name}
              </ListItem>
            ))}
            {groupIndex === TECHNOLOGY_GROUPS.length - 1 ? (
              <FieldGroup.SectionFooter>
                <NativeText modifiers={[font({ textStyle: "footnote" })]}>
                  {t("settings.technology.footer")}
                </NativeText>
              </FieldGroup.SectionFooter>
            ) : null}
          </FieldGroup.Section>
        ))}
      </FieldGroup>
    </Host>
  );
}
