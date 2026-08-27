import AddIcon from "@expo/material-symbols/add.xml";
import EventIcon from "@expo/material-symbols/event.xml";
import UploadIcon from "@expo/material-symbols/upload.xml";
import { Host, Icon } from "@expo/ui";
import { useTheme } from "expo-router/react-navigation";
import { View } from "react-native";
import { Button, Text } from "@/components/ui";
import { useResolvedColorScheme } from "@/hooks/useResolvedColorScheme";

export const EMPTY_SCHEDULE_ICON = Icon.select({
  ios: "calendar",
  android: EventIcon,
});
const IMPORT_SCHEDULE_ICON = Icon.select({
  ios: "square.and.arrow.down",
  android: UploadIcon,
});
const ADD_EVENT_ICON = Icon.select({
  ios: "calendar.badge.plus",
  android: AddIcon,
});

interface BlankConventionStateProps {
  title: string;
  subtitle: string;
  dateRange: string;
  timeZoneLabel: string;
  importLabel: string;
  addLabel: string;
  onImport: () => void;
  onAdd: () => void;
}

/** A saved convention with no schedule yet: both ways to fill it, side by side. */
export function BlankConventionState({
  title,
  subtitle,
  dateRange,
  timeZoneLabel,
  importLabel,
  addLabel,
  onImport,
  onAdd,
}: BlankConventionStateProps) {
  const colorScheme = useResolvedColorScheme();
  const { colors } = useTheme();

  return (
    <View className="flex-1 justify-center px-6 py-6">
      <View className="items-center gap-3">
        <Host colorScheme={colorScheme} matchContents pointerEvents="none">
          <Icon name={EMPTY_SCHEDULE_ICON} size={32} color={colors.primary} />
        </Host>
        <View className="items-center gap-1.5">
          <Text variant="h3" className="text-center">
            {title}
          </Text>
          <Text variant="body" className="text-center text-muted-foreground">
            {subtitle}
          </Text>
        </View>
        <View className="items-center gap-1 pt-1">
          <Text variant="label" className="text-center" selectable>
            {dateRange}
          </Text>
          <Text variant="caption" className="text-center" selectable>
            {timeZoneLabel}
          </Text>
        </View>
      </View>
      <View className="flex-row flex-wrap items-center justify-center gap-2 pt-4">
        <Button accessibilityLabel={importLabel} size="sm" onPress={onImport}>
          <View className="flex-row items-center gap-1.5">
            <Host
              colorScheme={colorScheme}
              matchContents
              pointerEvents="none"
              style={{ width: 18, height: 18 }}
            >
              <Icon
                name={IMPORT_SCHEDULE_ICON}
                size={18}
                color={colors.background}
              />
            </Host>
            <Text variant="label" className="text-primary-foreground">
              {importLabel}
            </Text>
          </View>
        </Button>
        <Button
          accessibilityLabel={addLabel}
          size="sm"
          variant="outline"
          onPress={onAdd}
        >
          <View className="flex-row items-center gap-1.5">
            <Host
              colorScheme={colorScheme}
              matchContents
              pointerEvents="none"
              style={{ width: 18, height: 18 }}
            >
              <Icon name={ADD_EVENT_ICON} size={18} color={colors.primary} />
            </Host>
            <Text variant="label">{addLabel}</Text>
          </View>
        </Button>
      </View>
    </View>
  );
}
