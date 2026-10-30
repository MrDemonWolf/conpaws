import { Host, Button as NativeButton } from "@expo/ui";
import { useTheme } from "expo-router/react-navigation";
import { useWindowDimensions, View } from "react-native";
import { Text } from "@/components/ui";
import { useResolvedColorScheme } from "@/hooks/useResolvedColorScheme";
import type { FormModalHeaderProps } from "./FormModalHeader.types";

/**
 * Header row for the Android form modals (create / edit / import).
 *
 * These Android forms deliberately hide the native header, so this row keeps
 * Cancel and Save inside their full-screen modal. Expo Router also supports native
 * `Stack.Toolbar` headers on Android; iOS uses that toolbar for its sheets and
 * never renders this component.
 *
 * The screens present as a full-screen `modal` on Android rather than a
 * `formSheet`; a sheet re-lays-out when the keyboard opens and clipped this row
 * down to unreadable slivers of Cancel and Save.
 */
export function FormModalHeader({
  title,
  cancelLabel,
  onCancel,
  confirmLabel,
  onConfirm,
  confirmDisabled,
}: FormModalHeaderProps) {
  const resolvedColorScheme = useResolvedColorScheme();
  const { colors } = useTheme();
  const { width, fontScale } = useWindowDimensions();
  // A full-width title keeps large text and long translations clear of actions.
  const expandedTitle = fontScale >= 1.4 || width < 360;

  return (
    <View className="border-b border-border px-3 py-2">
      <View className="flex-row flex-wrap items-center gap-2">
        <View className="shrink-0 items-start">
          <Host
            colorScheme={resolvedColorScheme}
            seedColor={colors.primary}
            matchContents
          >
            <NativeButton
              label={cancelLabel}
              onPress={onCancel}
              variant="text"
            />
          </Host>
        </View>
        {!expandedTitle ? (
          <Text
            variant="h3"
            accessibilityRole="header"
            className="min-w-0 flex-1 text-center"
          >
            {title}
          </Text>
        ) : null}
        <View className="ml-auto shrink-0 items-end">
          {confirmLabel && onConfirm ? (
            <Host
              colorScheme={resolvedColorScheme}
              seedColor={colors.primary}
              matchContents
            >
              <NativeButton
                label={confirmLabel}
                onPress={onConfirm}
                disabled={confirmDisabled}
              />
            </Host>
          ) : null}
        </View>
      </View>
      {expandedTitle ? (
        <Text variant="h3" accessibilityRole="header" className="pt-2">
          {title}
        </Text>
      ) : null}
    </View>
  );
}
