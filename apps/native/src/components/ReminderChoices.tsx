import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { Chip, Text } from "@/components/ui";
import { reminderDefaultLabel } from "@/lib/reminder-default-label";

export function ReminderChoices({
  label,
  value,
  options,
  onChange,
  testID,
}: {
  label: string;
  value: number | null;
  options: readonly number[];
  onChange: (value: number | null) => void;
  testID?: string;
}) {
  const { t } = useTranslation();
  return (
    <View className="gap-2">
      <Text variant="label">{label}</Text>
      <View className="flex-row flex-wrap gap-2" accessibilityLabel={label}>
        {[null, ...options].map((minutes) => (
          <Chip
            key={minutes ?? "none"}
            label={
              minutes === null
                ? t("reminders.none")
                : reminderDefaultLabel(minutes, t)
            }
            selected={value === minutes}
            onPress={() => onChange(minutes)}
            testID={testID ? `${testID}-${minutes ?? "none"}` : undefined}
          />
        ))}
      </View>
    </View>
  );
}
