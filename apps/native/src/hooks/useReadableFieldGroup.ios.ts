import {
  background,
  padding,
  scrollContentBackground,
} from "@expo/ui/swift-ui/modifiers";
import { useMemo } from "react";
import { PlatformColor } from "react-native";
import { useContentWidth } from "@/hooks/useContentWidth";
import type { ReadableFieldGroupProps } from "./useReadableFieldGroup";

/**
 * iOS: lay the SwiftUI Form into the readable column on a wide window.
 *
 * The Form drops its own grouped background, takes horizontal padding, and
 * paints the system grouped background behind itself, so the side gutters
 * match the sections' surroundings in light and dark. A drag in a gutter
 * does not scroll the Form, the same trade-off as Android's gutters.
 *
 * `listSectionMargins` looked like the native fit but leaves the sections
 * full width on iPadOS 27 (checked on an iPad Pro 11-inch simulator), so it
 * is not used. NativeWind cannot reach inside the Form either.
 */
export function useReadableFieldGroup({
  inSheet = false,
}: {
  inSheet?: boolean;
} = {}): ReadableFieldGroupProps {
  const { formSectionMargin } = useContentWidth();
  const margin = inSheet ? null : formSectionMargin;
  return useMemo(
    () =>
      margin === null
        ? {}
        : {
            modifiers: [
              scrollContentBackground("hidden"),
              padding({ horizontal: margin }),
              background(PlatformColor("systemGroupedBackground")),
            ],
          },
    [margin],
  );
}
