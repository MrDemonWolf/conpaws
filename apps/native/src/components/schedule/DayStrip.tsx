import { Pressable, ScrollView, View } from "react-native";
import { PRESS_DIM, Text } from "@/components/ui";
import { cn } from "@/lib/utils";

export interface DayStripDay {
  key: string;
  /** "Sat" */
  weekday: string;
  /** "19" */
  dayNumber: string;
  count: number;
  accessibilityLabel: string;
}

interface DayStripProps {
  /** "September 2026", set beside the strip. */
  monthLabel: string;
  days: readonly DayStripDay[];
  /** A day key, or `allKey`. */
  selectedKey: string;
  allKey: string;
  allLabel: string;
  allCount: number;
  allAccessibilityLabel: string;
  onSelect: (key: string) => void;
}

/**
 * The day strip under a convention's title: one cell per convention day plus
 * an "All" cell, scrolling sideways for long conventions. Custom on purpose
 * -- there is no stock iOS control for "a few days with counts" -- but built
 * only from supported primitives so it stays in step with the app's tokens.
 */
export function DayStrip({
  monthLabel,
  days,
  selectedKey,
  allKey,
  allLabel,
  allCount,
  allAccessibilityLabel,
  onSelect,
}: DayStripProps) {
  return (
    <View className="gap-2">
      <Text variant="caption" className="px-4 font-semibold uppercase">
        {monthLabel}
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
      >
        {days.map((day) => {
          const selected = day.key === selectedKey;
          return (
            <Pressable
              key={day.key}
              accessibilityRole="button"
              accessibilityLabel={day.accessibilityLabel}
              accessibilityState={{ selected }}
              onPress={() => onSelect(day.key)}
              className={cn(
                "min-h-16 min-w-14 items-center justify-center rounded-2xl px-2 py-2",
                selected ? "bg-info" : "bg-card",
                PRESS_DIM,
              )}
              style={{ borderCurve: "continuous" }}
            >
              <Text
                variant="caption"
                className={cn(
                  "font-semibold uppercase",
                  selected ? "text-info-foreground" : "text-muted-foreground",
                )}
              >
                {day.weekday}
              </Text>
              <Text
                variant="h3"
                accessibilityRole="none"
                className={cn(
                  "tabular-nums",
                  selected ? "text-info-foreground" : "text-foreground",
                )}
              >
                {day.dayNumber}
              </Text>
              {selected ? (
                <View className="mt-0.5 h-1 w-1 rounded-full bg-primary" />
              ) : null}
            </Pressable>
          );
        })}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={allAccessibilityLabel}
          accessibilityState={{ selected: selectedKey === allKey }}
          onPress={() => onSelect(allKey)}
          className={cn(
            "min-h-16 min-w-14 items-center justify-center rounded-2xl border px-2 py-2",
            selectedKey === allKey
              ? "border-transparent bg-info"
              : "border-border bg-transparent",
            PRESS_DIM,
          )}
          style={{ borderCurve: "continuous" }}
        >
          <Text
            variant="caption"
            className={cn(
              "font-semibold uppercase",
              selectedKey === allKey
                ? "text-info-foreground"
                : "text-muted-foreground",
            )}
          >
            {allLabel}
          </Text>
          <Text
            variant="h3"
            accessibilityRole="none"
            className={cn(
              "tabular-nums",
              selectedKey === allKey
                ? "text-info-foreground"
                : "text-foreground",
            )}
          >
            {allCount}
          </Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}
