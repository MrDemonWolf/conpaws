import { DateTimePicker } from "@expo/ui/community/datetime-picker";
import { useState } from "react";
import { Pressable, useWindowDimensions, View } from "react-native";
import { Text } from "@/components/ui";
import { useResolvedColorScheme } from "@/hooks/useResolvedColorScheme";
import { cn } from "@/lib/utils";

interface NativeDateTimeFieldProps {
  label: string;
  value: Date;
  mode: "date" | "time";
  locale: string;
  minimumDate?: Date;
  maximumDate?: Date;
  showDivider?: boolean;
  testID: string;
  onChange: (value: Date) => void;
}

export function NativeDateTimeField({
  label,
  value,
  mode,
  locale,
  minimumDate,
  maximumDate,
  showDivider = false,
  testID,
  onChange,
}: NativeDateTimeFieldProps) {
  const colorScheme = useResolvedColorScheme();
  const { fontScale } = useWindowDimensions();
  const [dialogVisible, setDialogVisible] = useState(false);
  const formattedValue =
    mode === "date"
      ? value.toLocaleDateString(locale, { dateStyle: "medium" })
      : value.toLocaleTimeString(locale, { timeStyle: "short" });
  const fieldClassName = cn(
    "min-h-14 flex-row items-center justify-between gap-4 px-4 py-2",
    showDivider && "border-b border-border",
  );
  // The compact UIDatePicker stretches to fill the row and then overflows past
  // its label, clipping the value against the card edge. It has no intrinsic
  // width and ignores flexShrink, so the frame has to be set explicitly.
  // ponytail: base widths fit the widest en-US value ("Sep 30, 2026" /
  // "10:00 PM") and scale with Dynamic Type. If a locale renders wider than
  // en-US, measure onLayout instead of widening these further.
  const pickerWidth = Math.round(
    (mode === "date" ? 148 : 112) * Math.min(Math.max(fontScale, 1), 1.6),
  );

  if (process.env.EXPO_OS === "ios") {
    return (
      <View className={fieldClassName}>
        <Text variant="body" className="shrink" numberOfLines={1}>
          {label}
        </Text>
        <DateTimePicker
          style={{ width: pickerWidth }}
          value={value}
          mode={mode}
          display="compact"
          minimumDate={minimumDate}
          maximumDate={maximumDate}
          locale={locale}
          themeVariant={colorScheme}
          testID={testID}
          onValueChange={(_, nextValue) => onChange(nextValue)}
        />
      </View>
    );
  }

  return (
    <>
      <Pressable
        className={cn(fieldClassName, "active:opacity-70")}
        accessibilityRole="button"
        accessibilityLabel={label}
        testID={testID}
        onPress={() => setDialogVisible(true)}
      >
        <Text variant="body">{label}</Text>
        <Text variant="body" className="text-primary" selectable>
          {formattedValue}
        </Text>
      </Pressable>
      {dialogVisible ? (
        <DateTimePicker
          value={value}
          mode={mode}
          minimumDate={minimumDate}
          maximumDate={maximumDate}
          presentation="dialog"
          onValueChange={(_, nextValue) => {
            onChange(nextValue);
            setDialogVisible(false);
          }}
          onDismiss={() => setDialogVisible(false)}
        />
      ) : null}
    </>
  );
}
