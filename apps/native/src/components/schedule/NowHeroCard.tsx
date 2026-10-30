import { ArrowRight, MapPin } from "lucide-react-native";
import { Pressable, useColorScheme, View } from "react-native";
import { Badge, Button, Card, PRESS_DIM, Text } from "@/components/ui";
import { themeTokens } from "@/lib/theme-tokens";

export interface NowHeroCardProps {
  /** "Happening now" or "Up next" */
  eyebrow: string;
  title: string;
  /** "2:00 to 3:00 PM" */
  timeLine: string;
  callout: {
    /** "Until" or "Starts at" */
    label: string;
    /** "3:00 PM" */
    value: string;
    /** "42 min left" / "12 min until it starts" / "End time not published" */
    sub?: string;
  };
  room?: string;
  venue?: string;
  reminderLabel?: string;
  next?: {
    /** "Next · 2:35 PM" */
    kicker: string;
    title: string;
    /** "Cedar · 10 min between" */
    meta: string;
    onPress: () => void;
    accessibilityLabel: string;
  };
  primaryLabel: string;
  onPrimary: () => void;
  /** Opens the hero event's own sheet. */
  onOpen: () => void;
  openAccessibilityLabel: string;
}

/**
 * The one card that answers the convention-day question: what am I doing,
 * until when, where, and what comes after. Every number on it is a published
 * time or a reminder the user set -- nothing is a computed departure.
 */
export function NowHeroCard({
  eyebrow,
  title,
  timeLine,
  callout,
  room,
  venue,
  reminderLabel,
  next,
  primaryLabel,
  onPrimary,
  onOpen,
  openAccessibilityLabel,
}: NowHeroCardProps) {
  const scheme = useColorScheme() === "dark" ? "dark" : "light";
  const tokens = themeTokens[scheme];

  return (
    <Card className="mx-4 my-2 gap-4 p-5">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={openAccessibilityLabel}
        onPress={onOpen}
        className={`gap-3 ${PRESS_DIM}`}
      >
        <Text
          variant="caption"
          className="font-semibold text-primary uppercase tracking-wide"
        >
          {eyebrow}
        </Text>
        <Text variant="h2">{title}</Text>
        <Text variant="body" className="text-muted-foreground">
          {timeLine}
        </Text>
        <View className="gap-0.5">
          <Text variant="caption" className="text-primary">
            {callout.label}
          </Text>
          <Text variant="h1" className="tabular-nums text-primary">
            {callout.value}
          </Text>
          {callout.sub ? (
            <Text variant="caption" className="text-primary">
              {callout.sub}
            </Text>
          ) : null}
        </View>
        {room || venue ? (
          <View
            className="flex-row items-center gap-3 rounded-xl bg-info p-3"
            style={{ borderCurve: "continuous" }}
          >
            <MapPin size={20} color={tokens.infoForeground} />
            <View className="flex-1">
              {room ? (
                <Text variant="label" className="text-info-foreground">
                  {room}
                </Text>
              ) : null}
              {venue ? (
                <Text variant="caption" className="text-info-foreground">
                  {venue}
                </Text>
              ) : null}
            </View>
          </View>
        ) : null}
        {reminderLabel ? (
          <View className="flex-row">
            <Badge variant="info" label={reminderLabel} />
          </View>
        ) : null}
      </Pressable>

      {next ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={next.accessibilityLabel}
          onPress={next.onPress}
          className={`flex-row items-center gap-3 border-border border-t pt-3 ${PRESS_DIM}`}
        >
          <View className="flex-1 gap-0.5">
            <Text
              variant="caption"
              className="font-semibold uppercase tracking-wide"
            >
              {next.kicker}
            </Text>
            <Text variant="label" className="font-semibold">
              {next.title}
            </Text>
            <Text variant="caption">{next.meta}</Text>
          </View>
          <ArrowRight size={18} color={tokens.mutedForeground} />
        </Pressable>
      ) : null}

      <Button onPress={onPrimary}>{primaryLabel}</Button>
    </Card>
  );
}
