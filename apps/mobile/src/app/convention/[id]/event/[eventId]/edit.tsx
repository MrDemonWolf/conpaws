import { useEffect, useState } from "react";
import { View, Text, ScrollView, Alert } from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { parseISO } from "date-fns";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DatePickerField } from "@/components/ui/date-picker-field";
import { useEvent, useUpdateEvent } from "@/hooks/use-events";

export default function EditEventScreen() {
  const { id, eventId } = useLocalSearchParams<{
    id: string;
    eventId: string;
  }>();
  const router = useRouter();
  const { data: event } = useEvent(eventId);
  const updateEvent = useUpdateEvent();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [room, setRoom] = useState("");
  const [category, setCategory] = useState("");
  const [startTime, setStartTime] = useState(new Date());
  const [endTime, setEndTime] = useState(new Date());

  useEffect(() => {
    if (event) {
      setTitle(event.title);
      setDescription(event.description ?? "");
      setLocation(event.location ?? "");
      setRoom(event.room ?? "");
      setCategory(event.category ?? "");
      setStartTime(parseISO(event.startTime));
      setEndTime(parseISO(event.endTime));
    }
  }, [event]);

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert("Error", "Please enter an event title.");
      return;
    }

    await updateEvent.mutateAsync({
      id: eventId,
      conventionId: id,
      data: {
        title: title.trim(),
        description: description.trim() || null,
        location: location.trim() || null,
        room: room.trim() || null,
        category: category.trim() || null,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
      },
    });

    router.back();
  };

  if (!event) return null;

  return (
    <>
      <Stack.Screen options={{ title: "Edit Event" }} />
      <ScrollView className="flex-1 bg-background px-6 pt-6">
        <View className="gap-4">
          <View>
            <Text className="mb-1.5 text-sm font-medium text-foreground">
              Title
            </Text>
            <Input value={title} onChangeText={setTitle} />
          </View>

          <View>
            <Text className="mb-1.5 text-sm font-medium text-foreground">
              Description
            </Text>
            <Input
              value={description}
              onChangeText={setDescription}
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
            <Input value={location} onChangeText={setLocation} />
          </View>

          <View>
            <Text className="mb-1.5 text-sm font-medium text-foreground">
              Room
            </Text>
            <Input value={room} onChangeText={setRoom} />
          </View>

          <View>
            <Text className="mb-1.5 text-sm font-medium text-foreground">
              Category
            </Text>
            <Input
              value={category}
              onChangeText={setCategory}
              autoCapitalize="characters"
            />
          </View>
        </View>

        <Button
          onPress={handleSave}
          className="mb-8 mt-8"
          disabled={updateEvent.isPending}
        >
          {updateEvent.isPending ? "Saving..." : "Save Changes"}
        </Button>
      </ScrollView>
    </>
  );
}
