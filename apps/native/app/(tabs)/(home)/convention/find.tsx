import { useQuery } from "@tanstack/react-query";
import { router, Stack, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ScrollView, SectionList, View } from "react-native";
import { CatalogEditionRow, CatalogFallbackCard } from "@/components/catalog";
import {
  Banner,
  ConventionListSkeleton,
  EmptyState,
  Row,
  SkeletonUnderHeader,
  Text,
} from "@/components/ui";
import { catalogEditionSummary } from "@/lib/catalog/adapter";
import { resolveCatalogSource } from "@/lib/catalog/source-preference";
import type { CatalogEdition } from "@/lib/catalog/types";
import { formatConventionDate } from "@/lib/event-time-format";
import { currentLocale } from "@/lib/i18n";
import {
  resetPresentationLock,
  tryAcquirePresentationLock,
} from "@/lib/presentation-lock";
import { NetworkError } from "@/lib/sched-extractor";

const CATALOG_STALE_TIME_MS = 5 * 60 * 1000;

export default function FindConventionScreen() {
  const { t } = useTranslation();
  const locale = currentLocale();
  const presentationLock = useRef(0);
  const [source, setSource] = useState(() => resolveCatalogSource(__DEV__));
  const [now, setNow] = useState(() => new Date());
  const [search, setSearch] = useState("");
  const [pastExpanded, setPastExpanded] = useState(false);

  useFocusEffect(
    useCallback(() => {
      resetPresentationLock(presentationLock);
      setNow(new Date());
      setSource(resolveCatalogSource(__DEV__));
    }, []),
  );

  const query = useQuery({
    queryKey: ["catalog", source.kind],
    queryFn: ({ signal }) => source.list(signal),
    staleTime: CATALOG_STALE_TIME_MS,
  });
  const editions = query.data ?? [];
  const filtered = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase(locale);
    if (!needle) return editions;
    return editions.filter((edition) =>
      [edition.name, edition.acronym, edition.city].some((value) =>
        value.toLocaleLowerCase(locale).includes(needle),
      ),
    );
  }, [editions, locale, search]);
  const grouped = useMemo(() => {
    const upcoming: CatalogEdition[] = [];
    const past: CatalogEdition[] = [];
    for (const edition of filtered) {
      (catalogEditionSummary(edition, now).isPast ? past : upcoming).push(
        edition,
      );
    }
    return { upcoming, past };
  }, [filtered, now]);
  const sections = [
    { key: "upcoming", title: t("catalog.upcoming"), data: grouped.upcoming },
    {
      key: "past",
      title: t("catalog.past"),
      data: pastExpanded ? grouped.past : [],
    },
  ];

  function openEdition(edition: CatalogEdition) {
    if (!tryAcquirePresentationLock(presentationLock)) return;
    router.push({
      pathname: "/convention/find/[slug]",
      params: { slug: edition.slug },
    });
  }

  function openImport() {
    if (!tryAcquirePresentationLock(presentationLock)) return;
    router.push("/convention/new/import");
  }

  function openCreate() {
    if (!tryAcquirePresentationLock(presentationLock)) return;
    router.push("/convention/create");
  }

  const queryFailure =
    query.error instanceof NetworkError ? "offline" : "unavailable";
  const errorTitle = t(
    queryFailure === "offline"
      ? "catalog.offline.title"
      : "catalog.unavailable.title",
  );
  const errorBody = t(
    queryFailure === "offline"
      ? "catalog.offline.body"
      : "catalog.unavailable.body",
  );
  const header = (
    <View className="gap-2 pb-2">
      {source.kind === "fixture" ? (
        <Text variant="caption" className="px-4 pt-3 text-muted-foreground">
          {t("catalog.sample")}
        </Text>
      ) : null}
      {query.isError && query.data ? (
        <Banner
          title={errorTitle}
          body={errorBody}
          actionLabel={t("catalog.retry")}
          onAction={() => void query.refetch()}
        />
      ) : null}
    </View>
  );
  const fallback = (
    <CatalogFallbackCard
      title={t("catalog.notListed.title")}
      body={t("catalog.notListed.body")}
      importLabel={t("catalog.notListed.import")}
      createLabel={t("catalog.notListed.create")}
      onImport={openImport}
      onCreate={openCreate}
    />
  );

  return (
    <View className="flex-1 bg-background">
      <Stack.Screen
        options={{
          title: t("catalog.title"),
          headerLargeTitleEnabled: process.env.EXPO_OS === "ios",
        }}
      />
      <Stack.SearchBar
        autoCapitalize="none"
        hideWhenScrolling
        placement="stacked"
        placeholder={t("catalog.searchPlaceholder")}
        onChangeText={(event) => setSearch(event.nativeEvent.text)}
        onCancelButtonPress={() => setSearch("")}
      />
      {query.isLoading ? (
        <SkeletonUnderHeader>
          <ConventionListSkeleton />
        </SkeletonUnderHeader>
      ) : query.isError && !query.data ? (
        <ScrollView
          className="flex-1"
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={{ flexGrow: 1, paddingVertical: 20 }}
        >
          <EmptyState
            title={errorTitle}
            subtitle={errorBody}
            ctaLabel={t("catalog.retry")}
            onCta={() => void query.refetch()}
            className="min-h-64 flex-none"
          />
          {fallback}
        </ScrollView>
      ) : (
        <SectionList
          className="flex-1"
          contentInsetAdjustmentBehavior="automatic"
          sections={sections}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => {
            const summary = catalogEditionSummary(item, now);
            const start = formatConventionDate(item.startsOn, locale);
            const end = formatConventionDate(item.endsOn, locale);
            return (
              <CatalogEditionRow
                edition={item}
                dateRange={t("home.dateRange", { start, end })}
                scheduleReady={summary.scheduleReady}
                scheduleReadyLabel={t("catalog.scheduleReady")}
                scheduleNotYetLabel={t("catalog.scheduleNotYet")}
                onPress={() => openEdition(item)}
              />
            );
          }}
          renderSectionHeader={({ section }) =>
            section.key === "past" ? (
              <Row
                className="mx-4 my-2 rounded-xl bg-card px-4"
                onPress={() => setPastExpanded((value) => !value)}
                accessibilityState={{ expanded: pastExpanded }}
              >
                <Text variant="label">{t("catalog.past")}</Text>
                <Text variant="caption" className="text-muted-foreground">
                  {t(pastExpanded ? "catalog.hidePast" : "catalog.showPast")}
                </Text>
              </Row>
            ) : (
              <Text variant="h3" className="px-4 pt-3 pb-2">
                {t("catalog.upcoming")}
              </Text>
            )
          }
          ListHeaderComponent={header}
          ListFooterComponent={fallback}
          ListEmptyComponent={
            filtered.length === 0 ? (
              <EmptyState
                title={
                  search.trim()
                    ? t("catalog.searchEmpty")
                    : t("catalog.empty.title")
                }
                subtitle={
                  search.trim()
                    ? t("catalog.searchEmptyBody")
                    : t("catalog.empty.body")
                }
                className="min-h-64 flex-none"
              />
            ) : null
          }
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 24 }}
        />
      )}
    </View>
  );
}
