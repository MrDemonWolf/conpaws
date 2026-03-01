import { useEffect, useState } from "react";
import { View, Text, ScrollView, Alert } from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { parseISO } from "date-fns";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DatePickerField } from "@/components/ui/date-picker-field";
import { useConvention, useUpdateConvention } from "@/hooks/use-conventions";

export default function EditConventionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data: convention } = useConvention(id);
  const updateConvention = useUpdateConvention();

  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());

  useEffect(() => {
    if (convention) {
      setName(convention.name);
      setStartDate(parseISO(convention.startDate));
      setEndDate(parseISO(convention.endDate));
    }
  }, [convention]);

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert("Error", "Please enter a convention name.");
      return;
    }

    await updateConvention.mutateAsync({
      id,
      data: {
        name: name.trim(),
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      },
    });

    router.back();
  };

  if (!convention) return null;

  return (
    <>
      <Stack.Screen options={{ title: "Edit Convention" }} />
      <ScrollView className="flex-1 bg-background px-6 pt-6">
        <View className="gap-4">
          <View>
            <Text className="mb-1.5 text-sm font-medium text-foreground">
              Name
            </Text>
            <Input value={name} onChangeText={setName} />
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
          disabled={updateConvention.isPending}
        >
          {updateConvention.isPending ? "Saving..." : "Save Changes"}
        </Button>
      </ScrollView>
    </>
  );
}
