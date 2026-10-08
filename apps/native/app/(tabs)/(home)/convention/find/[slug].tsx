import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  router,
  Stack,
  useFocusEffect,
  useLocalSearchParams,
} from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { AccessibilityInfo, ScrollView, View } from "react-native";
import {
  Banner,
  Button,
  Card,
  ConventionListSkeleton,
  SkeletonUnderHeader,
  Text,
} from "@/components/ui";
import * as conventionsRepo from "@/db/repositories/conventions";
import { runScheduleImport } from "@/hooks/useImportSchedule";
import {
  CatalogNotFoundError,
  CatalogUnavailableError,
} from "@/lib/catalog/client";
import { resolveCatalogSource } from "@/lib/catalog/source-preference";
import { formatConventionDate } from "@/lib/event-time-format";
import { currentLocale } from "@/lib/i18n";
import {
  resetPresentationLock,
  tryAcquirePresentationLock,
} from "@/lib/presentation-lock";
import { NetworkError } from "@/lib/sched-extractor";
import { localizedTimeZoneName } from "@/lib/time-zone-name";
import type { CatalogDownloadResult } from "@/services/catalog-download";
import { downloadCatalogEdition } from "@/services/catalog-download";
import { hapticSuccess } from "@/services/haptics";
import { publishWidgetSnapshot } from "@/services/widget-snapshot";

const CATALOG_STALE_TIME_MS = 5 * 60 * 1000;
type DownloadFailure = Extract<CatalogDownloadResult, { ok: false }>["reason"];

export default function FindConventionDetailScreen() {
  const { slug = "" } = useLocalSearchParams<{ slug: string }>();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const presentationLock = useRef(0);
  const inFlight = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  const [source, setSource] = useState(() => resolveCatalogSource(__DEV__));
  const [downloading, setDownloading] = useState(false);
  const [failure, setFailure] = useState<DownloadFailure | null>(null);
  const locale = currentLocale();

  useFocusEffect(
    useCallback(() => {
      resetPresentationLock(presentationLock);
      setSource(resolveCatalogSource(__DEV__));
    }, []),
  );
  useEffect(
    () => () => {
      mounted.current = false;
      inFlight.current?.abort();
    },
    [],
  );

  const catalogQuery = useQuery({
    queryKey: ["catalog", source.kind],
    queryFn: ({ signal }) => source.list(signal),
    staleTime: CATALOG_STALE_TIME_MS,
  });
  const edition = catalogQuery.data?.find((item) => item.slug === slug);
  const conventionQuery = useQuery({
    queryKey: ["conventionByCatalogSlug", slug],
    // React Query rejects `undefined` as data; null means "not downloaded".
    queryFn: async () => (await conventionsRepo.getByCatalogSlug(slug)) ?? null,
    enabled: slug.length > 0,
  });
  const downloaded = conventionQuery.data;
  const dates = edition
    ? t("home.dateRange", {
        start: formatConventionDate(edition.startsOn, locale),
        end: formatConventionDate(edition.endsOn, locale),
      })
    : "";
  const isReady = !!edition && edition.scheduleStatus !== "not-released";
  const isCurrentDownload =
    !!downloaded &&
    downloaded.catalogRevision !== null &&
    downloaded.catalogRevision >= (edition?.revision ?? 0);
  const canOpenSavedSchedule = !!downloaded && (!isReady || isCurrentDownload);

  async function handleDownload() {
    if (
      !edition ||
      downloading ||
      !tryAcquirePresentationLock(presentationLock)
    )
      return;
    const controller = new AbortController();
    inFlight.current = controller;
    setFailure(null);
    setDownloading(true);
    const result = await downloadCatalogEdition(
      { edition, source, signal: controller.signal },
      {
        getByCatalogSlug: conventionsRepo.getByCatalogSlug,
        createConvention: conventionsRepo.create,
        removeConvention: conventionsRepo.remove,
        importEvents: runScheduleImport,
        updateConvention: conventionsRepo.update,
        publishSnapshot: publishWidgetSnapshot,
        refreshCaches: (conventionId) =>
          Promise.allSettled([
            queryClient.invalidateQueries({ queryKey: ["conventions"] }),
            queryClient.invalidateQueries({
              queryKey: ["convention", conventionId],
            }),
            queryClient.invalidateQueries({
              queryKey: ["events", conventionId],
            }),
            queryClient.invalidateQueries({
              queryKey: ["conventionByCatalogSlug", slug],
            }),
          ]),
        haptic: hapticSuccess,
      },
    );
    if (inFlight.current === controller) inFlight.current = null;
    if (mounted.current) setDownloading(false);
    if (!mounted.current) return;
    if (!result.ok) {
      resetPresentationLock(presentationLock);
      if (result.reason !== "cancelled") setFailure(result.reason);
      return;
    }
    AccessibilityInfo.announceForAccessibility(
      t("catalog.confirm.successAnnouncement", { name: edition.name }),
    );
    router.replace({
      pathname: "/convention/[id]",
      params: { id: result.conventionId },
    });
  }

  function openSchedule() {
    if (!downloaded || !tryAcquirePresentationLock(presentationLock)) return;
    router.replace({
      pathname: "/convention/[id]",
      params: { id: downloaded.id },
    });
  }

  function openImport() {
    if (!tryAcquirePresentationLock(presentationLock)) return;
    router.push("/convention/new/import");
  }

  const failureCopy = (reason: DownloadFailure) => {
    switch (reason) {
      case "network":
        return [t("catalog.offline.title"), t("catalog.confirm.offline.body")];
      case "unavailable":
        return [
          t("catalog.confirm.unavailableHere.title"),
          t("catalog.confirm.unavailableHere.body"),
        ];
      case "not-found":
        return [
          t("catalog.confirm.notFound.title"),
          t("catalog.confirm.notFound.body"),
        ];
      case "import-failed":
        return [
          t("catalog.confirm.failed.title"),
          t("catalog.confirm.failed.body"),
        ];
      case "cancelled":
        return ["", ""];
    }
  };
  const queryErrorCopy = (error: unknown) => {
    if (error instanceof NetworkError) {
      return [t("catalog.offline.title"), t("catalog.offline.body")];
    }
    if (error instanceof CatalogNotFoundError) {
      return [
        t("catalog.confirm.notFound.title"),
        t("catalog.confirm.notFound.body"),
      ];
    }
    return error instanceof CatalogUnavailableError
      ? [
          t("catalog.confirm.unavailableHere.title"),
          t("catalog.confirm.unavailableHere.body"),
        ]
      : [t("catalog.unavailable.title"), t("catalog.unavailable.body")];
  };

  const queryError = catalogQuery.error
    ? queryErrorCopy(catalogQuery.error)
    : null;
  const failureMessage = failure ? failureCopy(failure) : null;
  const bannerCopy = failureMessage ?? queryError;
  const retry = () => {
    if (failure === "not-found" || catalogQuery.error) {
      void catalogQuery.refetch();
      setFailure(null);
    } else {
      void handleDownload();
    }
  };
  const scheduleLabel = isReady
    ? t("catalog.confirm.scheduleReady", {
        count: edition?.sessions.length ?? 0,
      })
    : t("catalog.confirm.scheduleNotYet");
  const downloadLabel = canOpenSavedSchedule
    ? t("catalog.confirm.open")
    : downloaded
      ? t("catalog.confirm.update")
      : isReady
        ? t("catalog.confirm.download")
        : t("catalog.confirm.scheduleNotYet");

  return (
    <View className="flex-1 bg-background">
      <Stack.Screen
        options={{
          title: edition?.name ?? t("catalog.title"),
          headerLargeTitleEnabled: process.env.EXPO_OS === "ios",
        }}
      />
      {catalogQuery.isLoading || conventionQuery.isLoading ? (
        <SkeletonUnderHeader>
          <ConventionListSkeleton />
        </SkeletonUnderHeader>
      ) : (
        <ScrollView
          className="flex-1"
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={{ paddingTop: 12, paddingBottom: 24 }}
        >
          {source.kind === "fixture" ? (
            <Text variant="caption" className="px-4 pb-3 text-muted-foreground">
              {t("catalog.sample")}
            </Text>
          ) : null}
          {bannerCopy ? (
            <Banner
              title={bannerCopy[0]}
              body={bannerCopy[1]}
              actionLabel={t("catalog.retry")}
              onAction={retry}
            />
          ) : null}
          {edition ? (
            <>
              <Card className="mx-4 gap-3">
                <View>
                  <Text variant="caption" className="text-muted-foreground">
                    {t("catalog.confirm.dates")}
                  </Text>
                  <Text variant="body">{dates}</Text>
                </View>
                <View className="h-px bg-border" />
                <View>
                  <Text variant="caption" className="text-muted-foreground">
                    {t("catalog.confirm.time")}
                  </Text>
                  <Text variant="body">
                    {localizedTimeZoneName(edition.timezone, locale)}
                  </Text>
                </View>
                <View className="h-px bg-border" />
                <View>
                  <Text variant="caption" className="text-muted-foreground">
                    {t("catalog.confirm.schedule")}
                  </Text>
                  <Text variant="body">{scheduleLabel}</Text>
                </View>
                <View className="h-px bg-border" />
                <View>
                  <Text variant="caption" className="text-muted-foreground">
                    {t("catalog.confirm.source")}
                  </Text>
                  <Text variant="body">
                    {t("catalog.confirm.sourceValue", {
                      revision: edition.revision,
                    })}
                  </Text>
                </View>
              </Card>
              {downloaded ? (
                <Text
                  variant="caption"
                  className="px-5 pt-3 text-muted-foreground"
                >
                  {t("catalog.confirm.downloaded", {
                    revision: downloaded.catalogRevision ?? edition.revision,
                  })}
                </Text>
              ) : null}
              <View className="gap-2 px-4 pt-4">
                <Button
                  onPress={canOpenSavedSchedule ? openSchedule : handleDownload}
                  disabled={!isReady && !downloaded}
                  loading={downloading}
                  accessibilityLabel={
                    downloading
                      ? t("catalog.confirm.downloading")
                      : downloadLabel
                  }
                >
                  {downloading
                    ? t("catalog.confirm.downloading")
                    : downloadLabel}
                </Button>
                {downloading ? (
                  <Text
                    variant="caption"
                    className="text-center text-muted-foreground"
                  >
                    {t("catalog.confirm.keepOpen")}
                  </Text>
                ) : null}
                {!isReady && !downloaded ? (
                  <Button onPress={openImport} variant="outline">
                    {t("catalog.notListed.import")}
                  </Button>
                ) : null}
              </View>
            </>
          ) : !catalogQuery.error ? (
            <Banner
              title={t("catalog.confirm.notFound.title")}
              body={t("catalog.confirm.notFound.body")}
              actionLabel={t("catalog.retry")}
              onAction={() => void catalogQuery.refetch()}
            />
          ) : null}
        </ScrollView>
      )}
    </View>
  );
}
