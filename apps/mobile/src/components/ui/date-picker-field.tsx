import { useState } from "react";
import { View, Text, Pressable, Platform } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { format } from "date-fns";

interface DatePickerFieldProps {
  label: string;
  value: Date;
  onChange: (date: Date) => void;
  mode?: "date" | "datetime";
  minimumDate?: Date;
  formatPattern?: string;
}

export function DatePickerField({
  label,
  value,
  onChange,
  mode = "date",
  minimumDate,
  formatPattern,
}: DatePickerFieldProps) {
  const [showPicker, setShowPicker] = useState(false);

  const defaultPattern =
    mode === "datetime" ? "EEE, MMM d 'at' h:mm a" : "EEEE, MMMM d, yyyy";
  const displayFormat = formatPattern ?? defaultPattern;

  return (
    <View>
      <Text className="mb-1.5 text-sm font-medium text-foreground">
        {label}
      </Text>
      <Pressable
        onPress={() => setShowPicker(true)}
        className="h-12 justify-center rounded-xl border border-input bg-background px-4"
      >
        <Text className="text-base text-foreground">
          {format(value, displayFormat)}
        </Text>
      </Pressable>
      {showPicker && (
        <DateTimePicker
          value={value}
          mode={mode}
          display={Platform.OS === "ios" ? "spinner" : "default"}
          minimumDate={minimumDate}
          onChange={(_, date) => {
            setShowPicker(Platform.OS === "ios");
            if (date) onChange(date);
          }}
        />
      )}
    </View>
  );
}
