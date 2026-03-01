import { useState } from "react";
import { View, Text, ScrollView, Alert } from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DatePickerField } from "@/components/ui/date-picker-field";
import { useCreateEvent } from "@/hooks/use-events";

export default function NewEventScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const createEvent = useCreateEvent();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [room, setRoom] = useState("");
  const [category, setCategory] = useState("");
  const [startTime, setStartTime] = useState(new Date());
  const [endTime, setEndTime] = useState(
    new Date(Date.now() + 60 * 60 * 1000),
  );

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert("Error", "Please enter an event title.");
      return;
    }

    await createEvent.mutateAsync({
      conventionId: id,
      title: title.trim(),
      description: description.trim() || null,
      location: location.trim() || null,
      room: room.trim() || null,
      category: category.trim() || null,
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      type: "custom",
    });

    router.back();
  };

  return (
    <>
      <Stack.Screen options={{ title: "New Event" }} />
      <ScrollView className="flex-1 bg-background px-6 pt-6">
        <View className="gap-4">
          <View>
            <Text className="mb-1.5 text-sm font-medium text-foreground">
              Title
            </Text>
            <Input
              value={title}
              onChangeText={setTitle}
              placeholder="Event title"
              autoFocus
            />
          </View>

          <View>
            <Text className="mb-1.5 text-sm font-medium text-foreground">
              Description
            </Text>
            <Input
              value={description}
              onChangeText={setDescription}
              placeholder="Optional description"
              multiline
              numberOfLines={3}
              className="h-24"
              textAlignVertical="top"
            />
          </View>

          <DatePickerField
            label="Start Time"
            value={startTime}
            onChange={setStartTime}
            mode="datetime"
          />

          <DatePickerField
            label="End Time"
            value={endTime}
            onChange={setEndTime}
            mode="datetime"
            minimumDate={startTime}
          />

          <View>
            <Text className="mb-1.5 text-sm font-medium text-foreground">
              Location
            </Text>
            <Input
              value={location}
              onChangeText={setLocation}
              placeholder="e.g. Convention Center"
            />
          </View>

          <View>
            <Text className="mb-1.5 text-sm font-medium text-foreground">
              Room
            </Text>
            <Input
              value={room}
              onChangeText={setRoom}
              placeholder="e.g. Main Hall"
            />
          </View>

          <View>
            <Text className="mb-1.5 text-sm font-medium text-foreground">
              Category
            </Text>
            <Input
              value={category}
              onChangeText={setCategory}
              placeholder="e.g. GAMING, FURSUITING"
              autoCapitalize="characters"
            />
          </View>
        </View>

        <Button
          onPress={handleSave}
          className="mb-8 mt-8"
          disabled={createEvent.isPending}
        >
          {createEvent.isPending ? "Creating..." : "Create Event"}
        </Button>
      </ScrollView>
    </>
  );
}
