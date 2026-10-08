import { useQuery } from "@tanstack/react-query";
import { getCalendars } from "expo-localization";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ScrollView, useColorScheme, View } from "react-native";
import { CompareCard } from "@/components/schedule/CompareCard";
import { SheetHeader } from "@/components/schedule/SheetHeader";
import { Button, Text } from "@/components/ui";
import * as conventionsRepo from "@/db/repositories/conventions";
import * as eventsRepo from "@/db/repositories/events";
import { useEventScheduleMutations } from "@/hooks/useEventScheduleMutations";
import { categoryAccentColor } from "@/lib/category-color";
import {
  compareCandidates,
  overlapMinutesBetween,
  planAfterChoice,
} from "@/lib/compare-candidates";
import { isValidTimeZone } from "@/lib/convention-time";
import { deviceHour12 } from "@/lib/device-clock";
import { formatEventEndTime, formatEventTime } from "@/lib/event-time-format";
import { currentLocale } from "@/lib/i18n";
import { setBrowseState } from "@/lib/schedule-browse-store";

/**
 * The compare sheet: a candidate that overlaps something already saved, the
 * saved panels it collides with, and one decision. Reads the same queries as
 * the convention screen, so its cards stay live, and leaves through the same
 * mutation path so haptics, announcements and the widget snapshot all fire.
 */
export default function CompareSheetRoute() {
  const {
    id,
    candidateId,
    selectedId: initialSelectedId,
  } = useLocalSearchParams<{
    id: string;
    candidateId: string;
    selectedId?: string;
  }>();
  const { t } = useTranslation();
  const locale = currentLocale();
  const hour12 = deviceHour12();
  const colorScheme = useColorScheme() === "dark" ? "dark" : "light";

  const { data: convention } = useQuery({
    queryKey: ["convention", id],
    queryFn: () => conventionsRepo.getById(id ?? ""),
    enabled: !!id,
  });
  const { data: events = [], isSuccess } = useQuery({
    queryKey: ["events", id],
    queryFn: () => eventsRepo.getByConventionId(id ?? ""),
    enabled: !!id,
  });

  const set = useMemo(
    () => (candidateId ? compareCandidates(events, candidateId) : null),
    [events, candidateId],
  );
  const [selectedId, setSelectedId] = useState(
    initialSelectedId ?? candidateId,
  );

  const { replaceInScheduleMutation } = useEventScheduleMutations({
    conventionId: id,
  });

  // A candidate the feed removed meanwhile leaves nothing to compare.
  useEffect(() => {
    if (isSuccess && set === null && router.canGoBack()) router.back();
  }, [isSuccess, set]);

  if (!set) return null;
  const compareSet = set;

  const storedTimeZone = convention?.timeZone;
  const timeZone = isValidTimeZone(storedTimeZone)
    ? storedTimeZone
    : (getCalendars()[0]?.timeZone ?? "UTC");
  const selected =
    set.cards.find((card) => card.id === selectedId) ?? set.candidate;
  const change = planAfterChoice(set, selected.id, false);
  const removedTitles = set.cards
    .filter((card) => change.remove.includes(card.id))
    .map((card) => card.title);
  const selectedIsSaved = selected.isInSchedule;

  const primaryLabel = selectedIsSaved
    ? change.remove.length > 0
      ? t("convention.compare.keepOnly")
      : t("convention.compare.keepPlan")
    : change.remove.length > 0
      ? t("convention.compare.switchTo")
      : t("convention.compare.addToPlan");

  const footerNote =
    change.remove.length === 0
      ? t("convention.compare.othersStay")
      : t(
          removedTitles.length === 1
            ? "convention.compare.replacesOne"
            : "convention.compare.replacesMany",
          { count: removedTitles.length, titles: removedTitles.join(", ") },
        );

  function commit(keepBoth: boolean) {
    const plan = planAfterChoice(compareSet, selected.id, keepBoth);
    if (plan.add.length === 0 && plan.remove.length === 0) {
      router.back();
      return;
    }
    replaceInScheduleMutation.mutate(
      {
        add: compareSet.cards.filter((card) => plan.add.includes(card.id)),
        remove: compareSet.cards.filter((card) =>
          plan.remove.includes(card.id),
        ),
      },
      {
        onSuccess: () => {
          if (id) setBrowseState(id, { notice: "updated" });
          router.back();
        },
      },
    );
  }

  return (
    <View className="flex-1 bg-background">
      <SheetHeader
        kicker={t(
          set.cards.length === 1
            ? "convention.compare.possibilitiesOne"
            : "convention.compare.possibilitiesMany",
          { count: set.cards.length },
        )}
        title={t("convention.compare.title")}
        subtitle={t("convention.compare.subtitle")}
        closeLabel={t("convention.closeEventDetails")}
        onClose={() => router.back()}
      />
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingVertical: 8, gap: 12 }}
        accessibilityRole="radiogroup"
      >
        {set.cards.map((card) => {
          const timeRange = card.endTime
            ? t("convention.eventTimeRange", {
                start: formatEventTime(
                  card.startTime,
                  timeZone,
                  locale,
                  hour12,
                ),
                end: formatEventEndTime(
                  card.startTime,
                  card.endTime,
                  timeZone,
                  locale,
                  hour12,
                ),
              })
            : formatEventTime(card.startTime, timeZone, locale, hour12);
          const overlap =
            card.id !== selected.id ? overlapMinutesBetween(selected, card) : 0;
          const room = card.room ?? card.location ?? undefined;
          return (
            <CompareCard
              key={card.id}
              title={card.title}
              category={card.category ?? undefined}
              accentColor={categoryAccentColor(card.category, colorScheme)}
              timeRange={timeRange}
              room={room}
              summary={card.description?.trim() || undefined}
              inPlan={card.isInSchedule}
              inPlanLabel={t("convention.compare.inPlan")}
              selected={card.id === selected.id}
              overlapNote={
                overlap > 0
                  ? t("convention.compare.overlapsChoice", { minutes: overlap })
                  : undefined
              }
              accessibilityLabel={[
                card.title,
                timeRange,
                room,
                card.isInSchedule ? t("convention.compare.inPlan") : null,
              ]
                .filter(Boolean)
                .join(", ")}
              onSelect={() => setSelectedId(card.id)}
            />
          );
        })}
      </ScrollView>
      <View className="gap-2 border-border border-t px-4 pt-3 pb-6">
        <Text variant="caption" className="text-center">
          {footerNote}
        </Text>
        <Button
          onPress={() => commit(false)}
          loading={replaceInScheduleMutation.isPending}
          testID="compare-primary"
        >
          {primaryLabel}
        </Button>
        {!selectedIsSaved && change.remove.length > 0 ? (
          <Button
            variant="outline"
            onPress={() => commit(true)}
            disabled={replaceInScheduleMutation.isPending}
            testID="compare-keep-both"
          >
            {t("convention.compare.keepBoth")}
          </Button>
        ) : null}
      </View>
    </View>
  );
}
