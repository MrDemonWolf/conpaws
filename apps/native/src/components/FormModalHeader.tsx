import { Host, Button as NativeButton } from "@expo/ui";
import { useTheme } from "expo-router/react-navigation";
import { View } from "react-native";
import { Text } from "@/components/ui";
import { useResolvedColorScheme } from "@/hooks/useResolvedColorScheme";

/**
 * Header row for the Android form modals (create / edit / import).
 *
 * Android needs this because `Stack.Toolbar` does not reach `headerLeft` /
 * `headerRight` there -- the toolbar renders on iOS only -- so without it the
 * form has a title but no way to commit or abandon it. iOS uses the real
 * `Stack.Toolbar` and never renders this component.
 *
 * The screens present as a full-screen `modal` on Android rather than a
 * `formSheet`; a sheet re-lays-out when the keyboard opens and clipped this row
 * down to unreadable slivers of Cancel and Save.
 */
/**
 * Safe-area edges for a form screen. Android's full-screen modal has no native
 * header, so under enforced edge-to-edge its own header row would otherwise
 * draw beneath the status bar; the iOS sheet supplies that inset itself.
 */
export const FORM_SAFE_EDGES: Array<"top" | "right" | "bottom" | "left"> =
  process.env.EXPO_OS === "ios" ? ["bottom"] : ["top", "bottom"];

export interface FormModalHeaderProps {
  title: string;
  cancelLabel: string;
  onCancel: () => void;
  /** Omit for a header with no confirm action, e.g. import. */
  confirmLabel?: string;
  onConfirm?: () => void;
  confirmDisabled?: boolean;
}

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

  return (
    <View className="flex-row items-center border-b border-border px-3 py-2">
      <View className="flex-1 items-start">
        <Host colorScheme={resolvedColorScheme} matchContents>
          <NativeButton label={cancelLabel} onPress={onCancel} variant="text" />
        </Host>
      </View>
      <Text variant="h3" accessibilityRole="header" className="text-center">
        {title}
      </Text>
      <View className="flex-1 items-end">
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
  );
}
