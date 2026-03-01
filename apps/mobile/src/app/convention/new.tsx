import { useState } from "react";
import { View, Text, ScrollView, Alert } from "react-native";
import { useRouter } from "expo-router";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DatePickerField } from "@/components/ui/date-picker-field";
import { useCreateConvention } from "@/hooks/use-conventions";

export default function NewConventionScreen() {
  const router = useRouter();
  const createConvention = useCreateConvention();

  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(
    new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
  );

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert("Error", "Please enter a convention name.");
      return;
    }

    if (endDate < startDate) {
      Alert.alert("Error", "End date must be after start date.");
      return;
    }

    await createConvention.mutateAsync({
      name: name.trim(),
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    });

    router.back();
  };

  return (
    <ScrollView className="flex-1 bg-background px-6 pt-6">
      <Text className="mb-6 text-2xl font-bold text-foreground">
        New Convention
      </Text>

      <View className="gap-4">
        <View>
          <Text className="mb-1.5 text-sm font-medium text-foreground">
            Name
          </Text>
          <Input
            value={name}
            onChangeText={setName}
            placeholder="e.g. Anthrocon 2026"
            autoFocus
          />
        </View>

        <DatePickerField
          label="Start Date"
          value={startDate}
          onChange={setStartDate}
        />

        <DatePickerField
          label="End Date"
          value={endDate}
          onChange={setEndDate}
          minimumDate={startDate}
        />
      </View>

      <Button
        onPress={handleSave}
        className="mt-8"
        disabled={createConvention.isPending}
      >
        {createConvention.isPending ? "Creating..." : "Create Convention"}
      </Button>
    </ScrollView>
  );
}
