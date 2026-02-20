import { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Platform,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import DateTimePicker from "@react-native-community/datetimepicker";
import { format } from "date-fns";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useCreateConvention } from "@/hooks/use-conventions";

export default function NewConventionScreen() {
  const router = useRouter();
  const createConvention = useCreateConvention();

  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(
    new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
  );
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

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
        disabled={createConvention.isPending}
      >
        {createConvention.isPending ? "Creating..." : "Create Convention"}
      </Button>
    </ScrollView>
  );
}
