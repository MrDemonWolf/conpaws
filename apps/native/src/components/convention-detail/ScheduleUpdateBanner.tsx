import { X } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Pressable, useColorScheme, View } from "react-native";
import { Text } from "@/components/ui";
import type { ScheduleChangeSummary } from "@/lib/schedule-changes";
import { themeTokens } from "@/lib/theme-tokens";

/**
 * Says what moved, once, and gets out of the way.
 *
 * It carries no button. The change has already been applied — the panel moved
 * whether or not anyone taps anything — so an action here would be theatre.
 * What the reader needs is a pointer to the rows below, which is where the
 * detail already lives, marked.
 *
 * No counts of anything the user did not save. A feed that shuffled forty
 * panels nobody starred renders nothing at all; the number in here is only
 * ever the number of decisions the reader actually made.
 */
interface ScheduleUpdateBannerProps {
  summary: ScheduleChangeSummary;
  onDismiss: () => void;
}

export function ScheduleUpdateBanner({
  summary,
  onDismiss,
}: ScheduleUpdateBannerProps) {
  const { t } = useTranslation();
  const isDark = useColorScheme() === "dark";
  const { savedMoved, savedGone } = summary;
  if (savedMoved === 0 && savedGone === 0) return null;

  // Gone outranks moved: a panel that is not happening changes the day more
  // than one that shifted rooms, and leading with it puts the sharper fact
  // first for someone scanning while walking.
  const title =
    savedGone > 0
      ? t(
          savedGone === 1
            ? "convention.scheduleUpdate.goneOne"
            : "convention.scheduleUpdate.goneMany",
          { count: savedGone },
        )
      : t(
          savedMoved === 1
            ? "convention.scheduleUpdate.movedOne"
            : "convention.scheduleUpdate.movedMany",
          { count: savedMoved },
        );

  const body =
    savedGone > 0 && savedMoved > 0
      ? t("convention.scheduleUpdate.alsoMoved", { count: savedMoved })
      : t("convention.scheduleUpdate.body");

  return (
    <View
      className="mx-4 mb-2 flex-row items-start gap-3 rounded-xl bg-secondary px-3 py-2"
      style={{ borderCurve: "continuous" }}
    >
      <View className="flex-1">
        <Text variant="label" accessibilityRole="alert">
          {title}
        </Text>
        <Text variant="caption" className="pt-0.5 text-muted-foreground">
          {body}
        </Text>
      </View>
      <Pressable
        onPress={onDismiss}
        accessibilityRole="button"
        accessibilityLabel={t("convention.scheduleUpdate.dismiss")}
        // Dismissing hides this sentence, never the marks on the rows. The
        // record of what happened stays where the reader will look for it.
        hitSlop={12}
        className="active:opacity-70"
      >
        {/* Icon colours are props, not classes — same documented pattern as
            ScheduleHintCard and EventItem's content-warning triangle. */}
        <X
          size={17}
          color={themeTokens[isDark ? "dark" : "light"].mutedForeground}
        />
      </Pressable>
    </View>
  );
}
