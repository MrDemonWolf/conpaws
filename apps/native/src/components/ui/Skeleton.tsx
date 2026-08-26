import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { View, type ViewProps } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { cn } from "@/lib/utils";

/**
 * Placeholder shapes shown while a screen's content loads.
 *
 * Why these and not the spinner they replace: a centred spinner says only "wait"
 * and leaves the screen otherwise blank, so the layout arrives all at once and
 * the reader starts from scratch. A skeleton that mirrors the real layout lets
 * someone see where the title, the times and the rows are going to be before the
 * data lands. NN/g's guidance is to prefer a skeleton when a *whole screen* is
 * loading and keep spinners for a single module or a confirmation, which is
 * exactly the split used here -- these replace the four full-screen spinners,
 * and the in-place spinners on buttons stay as they are.
 *
 * The pulse runs on Reanimated's UI thread deliberately. This animation plays
 * precisely when the JS thread is busy loading and parsing, and a JS-driven
 * pulse would stutter at the one moment it is on screen.
 */

const PULSE_DURATION_MS = 900;
/**
 * Dimmest point of the pulse.
 *
 * Measured rather than guessed: the blocks use `border` (#d1d1d6 on #ffffff,
 * about 1.5:1) because `muted` is #e5e5ea, which lands near 1.15:1 against a
 * light background and is effectively invisible. Dipping much below this took
 * even the `border` tone back out of sight -- a placeholder nobody can see is
 * the same as no placeholder at all.
 */
const PULSE_MIN_OPACITY = 0.55;

function usePulseStyle() {
  // Respecting the OS "reduce motion" switch is not optional here: a pulsing
  // block is exactly the kind of repeating animation that setting exists for.
  // The shapes still communicate the layout without it.
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(1);

  useEffect(() => {
    if (reduceMotion) {
      progress.value = 1;
      return;
    }
    progress.value = withRepeat(
      withTiming(PULSE_MIN_OPACITY, {
        duration: PULSE_DURATION_MS,
        easing: Easing.inOut(Easing.quad),
      }),
      -1,
      true,
    );
    return () => cancelAnimation(progress);
  }, [reduceMotion, progress]);

  return useAnimatedStyle(() => ({ opacity: progress.value }));
}

/**
 * One placeholder block. Size it with `className` the way the real element is
 * sized, so the skeleton keeps the same rhythm as the content it stands in for.
 */
export function Skeleton({ className, style, ...props }: ViewProps) {
  const pulseStyle = usePulseStyle();

  return (
    <Animated.View
      {...props}
      style={[pulseStyle, style]}
      className={cn("rounded-md bg-border", className)}
    />
  );
}

/**
 * Wraps a screen's placeholders so assistive tech hears "loading" once, rather
 * than reading out a dozen meaningless empty boxes.
 */
export function SkeletonScreen({
  className,
  children,
  ...props
}: ViewProps & { children: React.ReactNode }) {
  const { t } = useTranslation();

  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={t("common.loading")}
      accessibilityLiveRegion="polite"
      accessibilityState={{ busy: true }}
      importantForAccessibility="yes"
      className={cn("flex-1 bg-background", className)}
      {...props}
    >
      <View
        // The shapes are decoration; the label above already said everything
        // there is to say.
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        className="flex-1"
      >
        {children}
      </View>
    </View>
  );
}

/**
 * Stable keys for placeholder rows. These lists never reorder -- they exist for
 * exactly as long as a load takes -- so the keys only have to be unique.
 */
function placeholderKeys(prefix: string, count: number): string[] {
  return Array.from({ length: count }, (_, index) => `${prefix}-${index}`);
}

/** Mirrors `ConventionCard`: title line, then a date line with a status chip. */
export function ConventionListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <SkeletonScreen>
      <View className="px-4">
        {placeholderKeys("convention", rows).map((key, index) => (
          <View
            key={key}
            className={cn(
              "min-h-16 flex-row items-center gap-3 px-1 py-3",
              index < rows - 1 && "border-b border-border",
            )}
          >
            <View className="flex-1 gap-2">
              <Skeleton className="h-4 w-1/2" />
              <View className="flex-row items-center gap-2">
                <Skeleton className="h-3 w-40" />
                <Skeleton className="h-5 w-20 rounded-full" />
              </View>
            </View>
            <Skeleton className="h-5 w-1" />
          </View>
        ))}
      </View>
    </SkeletonScreen>
  );
}

/**
 * Mirrors the schedule's `SectionList`: a day header, then `EventItem` rows
 * whose left column is the fixed-width time block.
 */
export function ScheduleSkeleton({
  sections = 2,
  rowsPerSection = 3,
}: {
  sections?: number;
  rowsPerSection?: number;
}) {
  return (
    <SkeletonScreen>
      {placeholderKeys("schedule-section", sections).map((sectionKey) => (
        <View key={sectionKey}>
          <View className="px-4 pt-4 pb-2">
            <Skeleton className="h-4 w-32" />
          </View>
          {placeholderKeys(`${sectionKey}-row`, rowsPerSection).map(
            (rowKey) => (
              <View
                key={rowKey}
                className="min-h-14 flex-row gap-3 border-b border-border px-4 py-3"
              >
                <View className="w-20 shrink-0 gap-1.5">
                  <Skeleton className="h-4 w-14" />
                  <Skeleton className="h-3 w-12" />
                </View>
                <View className="flex-1 gap-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </View>
              </View>
            ),
          )}
        </View>
      ))}
    </SkeletonScreen>
  );
}

/** Mirrors a form's stack of labelled fields. */
export function FormSkeleton({ fields = 4 }: { fields?: number }) {
  return (
    <SkeletonScreen>
      <View className="gap-4 px-4 pt-4">
        {placeholderKeys("form-field", fields).map((key) => (
          <View key={key} className="gap-2">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-12 w-full rounded-xl" />
          </View>
        ))}
      </View>
    </SkeletonScreen>
  );
}
