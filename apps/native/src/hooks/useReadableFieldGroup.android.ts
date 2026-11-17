import { useMemo } from "react";
import { useContentWidth } from "@/hooks/useContentWidth";
import type { ReadableFieldGroupProps } from "./useReadableFieldGroup";

/**
 * Android: pad the Compose `LazyColumn` symmetrically. The padding sits
 * inside FieldGroup's surface background, so the gutters match the rows'
 * screen colour; capping the Host instead left gutters in a different colour.
 * Never wrap the Compose rows in React Native views to do this (see
 * `components/ui/RowSpinner`).
 *
 * Known limitation: the side gutters do not scroll. The padding becomes a
 * Compose `padding` modifier outside the LazyColumn's scrollable area, so a
 * drag in the gutter misses it (about 61dp a side on an 834dp window, 284dp
 * on a 1280dp one). @expo/ui 58's FieldGroup fixes its own `contentPadding`
 * at 16; move the gutter there once FieldGroup passes `contentPadding` on.
 */
export function useReadableFieldGroup({
  inSheet = false,
}: {
  inSheet?: boolean;
} = {}): ReadableFieldGroupProps {
  const { formGutter } = useContentWidth();
  const gutter = inSheet ? 0 : formGutter;
  return useMemo(
    () => (gutter > 0 ? { style: { paddingHorizontal: gutter } } : {}),
    [gutter],
  );
}
