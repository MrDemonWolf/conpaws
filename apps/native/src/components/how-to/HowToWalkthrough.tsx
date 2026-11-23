import {
  type ComponentRef,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import {
  AccessibilityInfo,
  type LayoutChangeEvent,
  ScrollView,
  View,
} from "react-native";
import { useReducedMotion } from "react-native-reanimated";
import { OnboardingButton } from "@/components/OnboardingButton";
import { OnboardingProgress } from "@/components/OnboardingProgress";
import { ReadableColumn, SafeView, Text } from "@/components/ui";
import { useContentWidth } from "@/hooks/useContentWidth";
import { ACTIONS_MAX, ONBOARDING_MAX } from "@/lib/content-width";
import { HOW_TO_GUIDES, type HowToMethod, type HowToStep } from "@/lib/how-to";
import { HowToPicture } from "./pictures";

interface HowToWalkthroughProps {
  method: HowToMethod;
  /** The last step's button: open the real screen, or close the help. */
  finishLabel: string;
  onFinish: () => void;
  /** The first step's second button, and Android back via the host. */
  onClose: () => void;
}

/**
 * The 3-4 swipeable steps of one "Show me how" guide. Shared by the Settings
 * route (`settings/how-to/[method]`) and the import screen's help modal, so
 * the two can never teach different steps.
 *
 * Each page is a picture and one or two plain sentences; the picture is
 * decorative and every instruction is in the text. A swipe turns the page,
 * and so do Next and Back, which also move VoiceOver and TalkBack to the new
 * title.
 *
 * Paging runs left to right. `supportsRTL` is false (app.config.ts). Flip the
 * index maths when a right-to-left language ships.
 */
export function HowToWalkthrough({
  method,
  finishLabel,
  onFinish,
  onClose,
}: HowToWalkthroughProps) {
  const { t } = useTranslation();
  const steps = HOW_TO_GUIDES[method].steps;
  const reduceMotion = useReducedMotion();
  // A wide window centres each page vertically; a phone, or a window too
  // short for it, keeps the page top-aligned and scrolling (OnboardingFrame).
  const { roomy } = useContentWidth();
  const [index, setIndex] = useState(0);
  // The pager's own size, not the window's: a sheet, Split View or Stage
  // Manager window is narrower than the screen.
  const [page, setPage] = useState({ width: 0, height: 0 });
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);
  const titleRefs = useRef<Array<ComponentRef<typeof View> | null>>([]);
  // Only Next and Back send focus to the new title; a swipe does not.
  const pendingFocus = useRef(false);
  // The resize effect reads the step from here. Listing `index` as its
  // dependency would cancel Next's animation by jumping straight to the page.
  const indexRef = useRef(0);
  const last = index === steps.length - 1;

  const body = (step: HowToStep) =>
    t(
      step.body,
      Object.fromEntries(
        Object.entries(step.labels ?? {}).map(([name, key]) => [name, t(key)]),
      ),
    );

  // Layout effects run in order, so the mirror is current before the resize
  // effect below reads it in the same commit.
  useLayoutEffect(() => {
    indexRef.current = index;
  }, [index]);

  // Rotation, Split View and Stage Manager change the page width; keep the
  // current page in view instead of half of two.
  useLayoutEffect(() => {
    if (page.width > 0) {
      scrollRef.current?.scrollTo({
        x: indexRef.current * page.width,
        animated: false,
      });
    }
  }, [page.width]);

  // After the new page is unhidden: focus sent to a still-hidden element is
  // dropped.
  useEffect(() => {
    if (!pendingFocus.current) return;
    pendingFocus.current = false;
    const node = titleRefs.current[index];
    if (node) AccessibilityInfo.sendAccessibilityEvent(node, "focus");
  }, [index]);

  function handleLayout(event: LayoutChangeEvent) {
    const { width, height } = event.nativeEvent.layout;
    setPage((current) =>
      current.width === width && current.height === height
        ? current
        : { width, height },
    );
  }

  function goTo(next: number) {
    pendingFocus.current = true;
    setIndex(next);
    scrollRef.current?.scrollTo({
      x: next * page.width,
      animated: !reduceMotion,
    });
  }

  /** Only the settled page goes into state, never the scroll position. */
  function settle(x: number) {
    if (page.width <= 0) return;
    const next = Math.min(
      Math.max(Math.round(x / page.width), 0),
      steps.length - 1,
    );
    if (next !== index) setIndex(next);
  }

  return (
    <SafeView edges={["left", "right", "bottom"]}>
      {/* Must stay the first child. react-native-screens switches the first
          scroll view in a screen's first-subview chain from "never" to
          "automatic" insets, which would shift a horizontal pager in
          landscape. */}
      <View className="px-4 pt-3">
        <ReadableColumn max={ONBOARDING_MAX} gutter={false}>
          <OnboardingProgress step={index + 1} total={steps.length} />
        </ReadableColumn>
      </View>
      <View className="flex-1" onLayout={handleLayout}>
        {page.width > 0 ? (
          <ScrollView
            ref={scrollRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            overScrollMode="never"
            contentInsetAdjustmentBehavior="never"
            automaticallyAdjustContentInsets={false}
            onMomentumScrollEnd={(event) =>
              settle(event.nativeEvent.contentOffset.x)
            }
          >
            {steps.map((step, i) => (
              <View
                key={step.id}
                style={{ width: page.width, height: page.height }}
                // Only the current page can be reached by a screen reader.
                accessibilityElementsHidden={i !== index}
                importantForAccessibility={
                  i === index ? "auto" : "no-hide-descendants"
                }
              >
                <ScrollView
                  contentInsetAdjustmentBehavior="never"
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={{
                    flexGrow: 1,
                    paddingHorizontal: 16,
                    paddingVertical: 16,
                    ...(roomy ? { justifyContent: "center" as const } : null),
                  }}
                >
                  <ReadableColumn
                    max={ONBOARDING_MAX}
                    gutter={false}
                    className="gap-5"
                  >
                    <HowToPicture id={step.picture} surface="background" />
                    <View className="gap-2">
                      <View
                        ref={(node) => {
                          titleRefs.current[i] = node;
                        }}
                        accessible
                        accessibilityRole="header"
                      >
                        <Text variant="h2">{t(step.title)}</Text>
                      </View>
                      <Text variant="body" className="text-muted-foreground">
                        {body(step)}
                      </Text>
                    </View>
                  </ReadableColumn>
                </ScrollView>
              </View>
            ))}
          </ScrollView>
        ) : null}
      </View>
      {/* The OnboardingFrame actions bar. The second button is always there,
          so the pager's height never jumps between steps. */}
      <ReadableColumn max={ACTIONS_MAX} className="gap-1 px-4 pt-1 pb-2">
        <OnboardingButton
          label={last ? finishLabel : t("howTo.next")}
          onPress={last ? onFinish : () => goTo(index + 1)}
          testID={last ? "how-to-finish" : "how-to-next"}
        />
        <OnboardingButton
          variant="text"
          label={index === 0 ? t("howTo.close") : t("howTo.back")}
          onPress={index === 0 ? onClose : () => goTo(index - 1)}
          testID={index === 0 ? "how-to-close" : "how-to-back"}
        />
      </ReadableColumn>
    </SafeView>
  );
}
