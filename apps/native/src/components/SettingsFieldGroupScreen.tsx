import { FieldGroup, Host } from "@expo/ui";
import { useTheme } from "expo-router/react-navigation";
import type { ReactNode } from "react";
import { useReadableFieldGroup } from "@/hooks/useReadableFieldGroup";
import { useResolvedColorScheme } from "@/hooks/useResolvedColorScheme";

/**
 * The body of a pushed Settings screen: a full-window `Host` in the app's
 * seeded palette, holding a `FieldGroup` that keeps to the readable column in
 * a wide window. Pass the screen's `FieldGroup.Section`s as children; they
 * stay direct children of the `FieldGroup`.
 *
 * A component is fine here, unlike the rows: nothing inspects the type of the
 * `Host`'s parent.
 */
export function SettingsFieldGroupScreen({
  children,
}: {
  children: ReactNode;
}) {
  const { colors } = useTheme();
  const colorScheme = useResolvedColorScheme();
  const readableGroup = useReadableFieldGroup();

  return (
    <Host
      colorScheme={colorScheme}
      seedColor={colors.primary}
      style={{ flex: 1 }}
      useViewportSizeMeasurement
    >
      <FieldGroup {...readableGroup}>{children}</FieldGroup>
    </Host>
  );
}
