import { router, Stack } from "expo-router";
import { useTheme } from "expo-router/react-navigation";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  AccessibilityInfo,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import licenseManifest from "@/generated/open-source-licenses.json";

type LicensePackage = {
  name: string;
  version: string;
  license: string;
  index: number;
};

const packages: LicensePackage[] = licenseManifest.packages.map(
  ({ name, version, license }, index) => ({ name, version, license, index }),
);

export default function LicensesScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const filteredPackages = normalizedQuery
    ? packages.filter(({ name, version, license }) =>
        `${name} ${version} ${license}`
          .toLocaleLowerCase()
          .includes(normalizedQuery),
      )
    : packages;

  useEffect(() => {
    if (!normalizedQuery) return;
    const timer = setTimeout(() => {
      AccessibilityInfo.announceForAccessibility(
        t("settings.licenses.packageCount", {
          count: filteredPackages.length,
        }),
      );
    }, 300);
    return () => clearTimeout(timer);
  }, [filteredPackages.length, normalizedQuery, t]);

  return (
    <>
      <Stack.SearchBar
        autoCapitalize="none"
        hideWhenScrolling={false}
        onCancelButtonPress={() => setQuery("")}
        onChangeText={(event) => setQuery(event.nativeEvent.text)}
        onClose={() => setQuery("")}
        placeholder={t("settings.licenses.searchPlaceholder")}
      />
      <FlatList
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.content}
        data={filteredPackages}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        keyExtractor={({ index, name, version }) =>
          `${name}@${version}:${index}`
        }
        ListHeaderComponent={
          <Text
            accessibilityRole="header"
            style={[styles.count, { color: colors.text }]}
          >
            {t("settings.licenses.packageCount", {
              count: filteredPackages.length,
            })}
          </Text>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              {t("settings.licenses.noResultsTitle")}
            </Text>
            <Text style={[styles.emptyDescription, { color: colors.text }]}>
              {t("settings.licenses.noResultsDescription")}
            </Text>
          </View>
        }
        renderItem={({ item, index }) => {
          const isFirst = index === 0;
          const isLast = index === filteredPackages.length - 1;
          return (
            <Pressable
              accessibilityLabel={`${item.name}, ${t(
                "settings.licenses.version",
                { version: item.version },
              )}, ${t("settings.licenses.license", {
                license: item.license,
              })}`}
              accessibilityRole="button"
              onPress={() =>
                router.push({
                  pathname: "/settings/licenses/[id]",
                  params: { id: String(item.index) },
                })
              }
              style={({ pressed }) => [
                styles.row,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  opacity: pressed ? 0.65 : 1,
                },
                isFirst && styles.firstRow,
                isLast && styles.lastRow,
              ]}
            >
              <View style={styles.rowText}>
                <Text
                  numberOfLines={1}
                  style={[styles.packageName, { color: colors.text }]}
                >
                  {item.name}
                </Text>
                <Text
                  numberOfLines={1}
                  style={[styles.metadata, { color: colors.text }]}
                >
                  {item.version} · {item.license}
                </Text>
              </View>
              <Text
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
                style={[styles.chevron, { color: colors.text }]}
              >
                ›
              </Text>
            </Pressable>
          );
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 32,
  },
  count: {
    fontSize: 13,
    fontWeight: "600",
    opacity: 0.62,
    paddingHorizontal: 4,
    paddingBottom: 8,
  },
  row: {
    minHeight: 58,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
  },
  firstRow: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  lastRow: {
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  packageName: {
    fontSize: 16,
    fontWeight: "600",
    lineHeight: 21,
  },
  metadata: {
    fontSize: 13,
    lineHeight: 18,
    opacity: 0.64,
  },
  chevron: {
    fontSize: 25,
    lineHeight: 28,
    marginLeft: 12,
    opacity: 0.42,
  },
  empty: {
    alignItems: "center",
    paddingHorizontal: 32,
    paddingVertical: 72,
    gap: 6,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
  },
  emptyDescription: {
    fontSize: 15,
    lineHeight: 21,
    opacity: 0.68,
    textAlign: "center",
  },
});
