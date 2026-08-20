import { Stack, useLocalSearchParams } from "expo-router";
import { useTheme } from "expo-router/react-navigation";
import * as WebBrowser from "expo-web-browser";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import licenseManifest from "@/generated/open-source-licenses.json";

function safeExternalUrl(value: string) {
  return /^https?:\/\//i.test(value) ? value : "";
}

export default function LicenseDetailsScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const index = Number(id);
  const packageInfo = Number.isInteger(index)
    ? licenseManifest.packages[index]
    : undefined;

  if (!packageInfo) {
    return (
      <View style={styles.notFound}>
        <Stack.Screen
          options={{ title: t("settings.licenses.detailsTitle") }}
        />
        <Text style={[styles.notFoundTitle, { color: colors.text }]}>
          {t("settings.licenses.packageNotFoundTitle")}
        </Text>
        <Text style={[styles.notFoundDescription, { color: colors.text }]}>
          {t("settings.licenses.packageNotFoundDescription")}
        </Text>
      </View>
    );
  }

  const licenseText = packageInfo.textId
    ? licenseManifest.texts[
        packageInfo.textId as keyof typeof licenseManifest.texts
      ]
    : "";
  const repository = safeExternalUrl(packageInfo.repository);
  const homepage = safeExternalUrl(packageInfo.homepage);
  const links = [
    repository
      ? { label: t("settings.licenses.repository"), url: repository }
      : null,
    homepage && homepage !== repository
      ? { label: t("settings.licenses.projectWebsite"), url: homepage }
      : null,
  ].filter((link): link is { label: string; url: string } => link !== null);

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.content}
    >
      <Stack.Screen options={{ title: packageInfo.name }} />
      <View
        accessible
        accessibilityRole="summary"
        style={[
          styles.summary,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <Text selectable style={[styles.packageName, { color: colors.text }]}>
          {packageInfo.name}
        </Text>
        <Text selectable style={[styles.metadata, { color: colors.text }]}>
          {t("settings.licenses.version", { version: packageInfo.version })}
        </Text>
        <Text selectable style={[styles.metadata, { color: colors.text }]}>
          {t("settings.licenses.license", { license: packageInfo.license })}
        </Text>
      </View>

      {links.length > 0 ? (
        <View style={styles.links}>
          {links.map(({ label, url }) => (
            <Pressable
              accessibilityRole="link"
              key={label}
              onPress={() => WebBrowser.openBrowserAsync(url)}
              style={({ pressed }) => [
                styles.link,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  opacity: pressed ? 0.65 : 1,
                },
              ]}
            >
              <Text style={[styles.linkLabel, { color: colors.primary }]}>
                {label}
              </Text>
              <Text
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
                style={[styles.external, { color: colors.primary }]}
              >
                ↗
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      <Text
        accessibilityRole="header"
        style={[styles.sectionTitle, { color: colors.text }]}
      >
        {t("settings.licenses.license", { license: packageInfo.license })}
      </Text>
      <View
        style={[
          styles.licenseCard,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <Text selectable style={[styles.licenseText, { color: colors.text }]}>
          {licenseText || t("settings.licenses.licenseTextUnavailable")}
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 40,
    gap: 16,
  },
  summary: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    padding: 16,
    gap: 4,
  },
  packageName: {
    fontSize: 20,
    fontWeight: "700",
    lineHeight: 26,
  },
  metadata: {
    fontSize: 14,
    lineHeight: 20,
    opacity: 0.68,
  },
  links: {
    gap: 8,
  },
  link: {
    minHeight: 48,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
  },
  linkLabel: {
    flex: 1,
    fontSize: 16,
    fontWeight: "600",
  },
  external: {
    fontSize: 18,
    marginLeft: 12,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    opacity: 0.62,
    paddingHorizontal: 4,
  },
  licenseCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    padding: 16,
  },
  licenseText: {
    fontSize: 14,
    lineHeight: 21,
  },
  notFound: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    gap: 6,
  },
  notFoundTitle: {
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center",
  },
  notFoundDescription: {
    fontSize: 15,
    lineHeight: 21,
    opacity: 0.68,
    textAlign: "center",
  },
});
