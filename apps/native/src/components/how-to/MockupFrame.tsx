import { createContext, type ReactNode, useContext } from "react";
import { View } from "react-native";
import { Text } from "@/components/ui";
import { cn } from "@/lib/utils";

/** What the frame sits on: a Card, or the page itself. */
export type MockupSurface = "card" | "background";

const SURFACE_CLASS: Record<MockupSurface, string> = {
  card: "bg-card",
  background: "bg-background",
};

const OPPOSITE: Record<MockupSurface, MockupSurface> = {
  card: "background",
  background: "card",
};

/** The colour rows take inside a frame: the opposite of the frame's own. */
const RowSurface = createContext<MockupSurface>("card");

/** True inside a Spotlight, which already sits where the row's margin goes. */
const InSpotlight = createContext(false);

/**
 * The picture frame of a how-to card or step: a simplified mockup of a real
 * screen, built from the app's own components so it follows the theme, the
 * text size and the language.
 *
 * Decorative only. Every instruction is real text beside it, so the frame is
 * hidden from VoiceOver and TalkBack and takes no touches. Controls inside it
 * also pass `focusable={false}`, because hiding a view from TalkBack does not
 * stop a hardware keyboard from focusing it.
 *
 * The frame is onboarding's practice frame (`features.tsx`): no border, and
 * the opposite surface of whatever it sits on.
 */
export function MockupFrame({
  surface,
  caption,
  children,
}: {
  surface: MockupSurface;
  caption?: string;
  children: ReactNode;
}) {
  const frame = OPPOSITE[surface];

  return (
    <RowSurface.Provider value={surface}>
      <View
        accessible={false}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        pointerEvents="none"
        style={{ borderCurve: "continuous" }}
        className={cn(
          "gap-2 overflow-hidden rounded-2xl py-3",
          SURFACE_CLASS[frame],
        )}
      >
        {caption ? (
          <Text variant="caption" className="px-4 font-semibold">
            {caption}
          </Text>
        ) : null}
        {children}
      </View>
    </RowSurface.Provider>
  );
}

interface MockRowProps {
  title: string;
  detail?: string;
  leading?: ReactNode;
  trailing?: ReactNode;
  titleClassName?: string;
  /** One line, shortened in the middle: for an address. */
  singleLine?: boolean;
}

/**
 * A list row inside a mockup, the shape of Find's "Past" row. A plain View:
 * it is never pressable.
 */
export function MockRow({
  title,
  detail,
  leading,
  trailing,
  titleClassName,
  singleLine = false,
}: MockRowProps) {
  const surface = useContext(RowSurface);
  // A Spotlight is placed inside the row's gutter, so the row drops its own.
  const inSpotlight = useContext(InSpotlight);

  return (
    <View
      style={{ borderCurve: "continuous" }}
      className={cn(
        !inSpotlight && "mx-4",
        "flex-row items-center gap-3 rounded-xl px-4 py-3",
        SURFACE_CLASS[surface],
      )}
    >
      {leading}
      <View className="flex-1 gap-0.5">
        <Text
          variant="label"
          className={titleClassName}
          numberOfLines={singleLine ? 1 : undefined}
          ellipsizeMode={singleLine ? "middle" : undefined}
        >
          {title}
        </Text>
        {detail ? <Text variant="caption">{detail}</Text> : null}
      </View>
      {trailing}
    </View>
  );
}

/**
 * A still ring around the control to tap. Its negative margin cancels its
 * border and padding, so the control keeps exactly the place it would have
 * without the ring. Put it where the control sits, for example inside
 * `<View className="mx-4">`, and never around a shared component that carries
 * its own outer margin.
 */
export function Spotlight({
  pill = false,
  children,
}: {
  pill?: boolean;
  children: ReactNode;
}) {
  return (
    <InSpotlight.Provider value={true}>
      <View
        className={cn("border-primary", pill ? "rounded-full" : "rounded-2xl")}
        style={{
          borderWidth: 2,
          padding: 2,
          margin: -4,
          borderCurve: "continuous",
        }}
      >
        {children}
      </View>
    </InSpotlight.Provider>
  );
}
