import { X } from "lucide-react-native";
import { Pressable, useColorScheme, View } from "react-native";
import { PRESS_DIM, Text } from "@/components/ui";
import { themeTokens } from "@/lib/theme-tokens";

interface SheetHeaderProps {
  /** Small line above the title: "3 possibilities". */
  kicker?: string;
  title: string;
  subtitle?: string;
  closeLabel: string;
  onClose: () => void;
}

/**
 * The top of a form sheet that hides the native header: a kicker, a title,
 * and one close control. The sheet's grabber and drag-to-dismiss stay with
 * the system; this only adds the explicit button VoiceOver needs.
 */
export function SheetHeader({
  kicker,
  title,
  subtitle,
  closeLabel,
  onClose,
}: SheetHeaderProps) {
  const scheme = useColorScheme() === "dark" ? "dark" : "light";

  return (
    <View className="gap-1 px-4 pt-3 pb-2">
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1 gap-1">
          {kicker ? (
            <Text variant="caption" className="font-semibold uppercase">
              {kicker}
            </Text>
          ) : null}
          <Text variant="h2">{title}</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={closeLabel}
          hitSlop={8}
          onPress={onClose}
          className={`h-11 w-11 items-center justify-center rounded-full bg-card ${PRESS_DIM}`}
        >
          <X size={20} color={themeTokens[scheme].foreground} />
        </Pressable>
      </View>
      {subtitle ? (
        <Text variant="body" className="text-muted-foreground">
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}
