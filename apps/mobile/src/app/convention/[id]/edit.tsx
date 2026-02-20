import { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Platform,
  Alert,
} from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import DateTimePicker from "@react-native-community/datetimepicker";
import { format, parseISO } from "date-fns";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useConvention, useUpdateConvention } from "@/hooks/use-conventions";

export default function EditConventionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data: convention } = useConvention(id);
  const updateConvention = useUpdateConvention();

  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

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

          <View>
            <Text className="mb-1.5 text-sm font-medium text-foreground">
              Start Date
            </Text>
            <Pressable
              onPress={() => setShowStartPicker(true)}
              className="h-12 justify-center rounded-xl border border-input bg-background px-4"
            >
              <Text className="text-base text-foreground">
                {format(startDate, "EEEE, MMMM d, yyyy")}
              </Text>
            </Pressable>
            {showStartPicker && (
              <DateTimePicker
                value={startDate}
                mode="date"
                display={Platform.OS === "ios" ? "spinner" : "default"}
                onChange={(_, date) => {
                  setShowStartPicker(Platform.OS === "ios");
                  if (date) setStartDate(date);
                }}
              />
            )}
          </View>

          <View>
            <Text className="mb-1.5 text-sm font-medium text-foreground">
              End Date
            </Text>
            <Pressable
              onPress={() => setShowEndPicker(true)}
              className="h-12 justify-center rounded-xl border border-input bg-background px-4"
            >
              <Text className="text-base text-foreground">
                {format(endDate, "EEEE, MMMM d, yyyy")}
              </Text>
            </Pressable>
            {showEndPicker && (
              <DateTimePicker
                value={endDate}
                mode="date"
                display={Platform.OS === "ios" ? "spinner" : "default"}
                minimumDate={startDate}
                onChange={(_, date) => {
                  setShowEndPicker(Platform.OS === "ios");
                  if (date) setEndDate(date);
                }}
              />
            )}
          </View>
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
