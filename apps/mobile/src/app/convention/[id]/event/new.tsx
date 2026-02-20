import { useState } from "react";
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
import { format } from "date-fns";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

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

          <View>
            <Text className="mb-1.5 text-sm font-medium text-foreground">
              Start Time
            </Text>
            <Pressable
              onPress={() => setShowStartPicker(true)}
              className="h-12 justify-center rounded-xl border border-input bg-background px-4"
            >
              <Text className="text-base text-foreground">
                {format(startTime, "EEE, MMM d 'at' h:mm a")}
              </Text>
            </Pressable>
            {showStartPicker && (
              <DateTimePicker
                value={startTime}
                mode="datetime"
                display={Platform.OS === "ios" ? "spinner" : "default"}
                onChange={(_, date) => {
                  setShowStartPicker(Platform.OS === "ios");
                  if (date) setStartTime(date);
                }}
              />
            )}
          </View>

          <View>
            <Text className="mb-1.5 text-sm font-medium text-foreground">
              End Time
            </Text>
            <Pressable
              onPress={() => setShowEndPicker(true)}
              className="h-12 justify-center rounded-xl border border-input bg-background px-4"
            >
              <Text className="text-base text-foreground">
                {format(endTime, "EEE, MMM d 'at' h:mm a")}
              </Text>
            </Pressable>
            {showEndPicker && (
              <DateTimePicker
                value={endTime}
                mode="datetime"
                display={Platform.OS === "ios" ? "spinner" : "default"}
                minimumDate={startTime}
                onChange={(_, date) => {
                  setShowEndPicker(Platform.OS === "ios");
                  if (date) setEndTime(date);
                }}
              />
            )}
          </View>

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
