import { useState } from "react";
import {
  Alert,
  FlatList,
  Text,
  View,
} from "react-native";
import {
  useConventions,
  getConventionStatus,
} from "@/hooks/use-conventions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import type { Convention } from "@/types";

function AddConventionForm({
  onAdd,
  onCancel,
}: {
  onAdd: (convention: Omit<Convention, "id">) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [icalUrl, setIcalUrl] = useState("");

  function handleSubmit() {
    if (!name.trim() || !startDate.trim() || !endDate.trim()) {
      Alert.alert("Missing fields", "Please fill in the convention name, start date, and end date.");
      return;
    }

    // Validate date format (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
      Alert.alert("Invalid date", "Please use YYYY-MM-DD format for dates.");
      return;
    }

    onAdd({
      name: name.trim(),
      startDate,
      endDate,
      icalUrl: icalUrl.trim() || null,
    });
  }

  return (
    <Card className="mx-4 mt-4">
      <CardHeader>
        <CardTitle>Add Convention</CardTitle>
      </CardHeader>
      <CardContent className="gap-3">
        <Input placeholder="Convention name" value={name} onChangeText={setName} />
        <Input
          placeholder="Start date (YYYY-MM-DD)"
          value={startDate}
          onChangeText={setStartDate}
        />
        <Input
          placeholder="End date (YYYY-MM-DD)"
          value={endDate}
          onChangeText={setEndDate}
        />
        <Input
          placeholder="iCal URL (optional)"
          value={icalUrl}
          onChangeText={setIcalUrl}
          autoCapitalize="none"
          keyboardType="url"
        />
        <View className="flex-row gap-3">
          <Button className="flex-1" onPress={handleSubmit}>
            Add
          </Button>
          <Button className="flex-1" variant="outline" onPress={onCancel}>
            Cancel
          </Button>
        </View>
      </CardContent>
    </Card>
  );
}

function ConventionCard({ convention }: { convention: Convention }) {
  const { status, label } = getConventionStatus(convention);

  const statusVariant =
    status === "active"
      ? "default"
      : status === "upcoming"
        ? "secondary"
        : "secondary";

  return (
    <Card className="mx-4">
      <CardHeader>
        <View className="flex-row items-center justify-between">
          <CardTitle className="flex-1">{convention.name}</CardTitle>
          <Badge variant={statusVariant}>{label}</Badge>
        </View>
      </CardHeader>
      <CardContent>
        <Text className="text-sm text-gray-500 dark:text-gray-400">
          {convention.startDate} — {convention.endDate}
        </Text>
      </CardContent>
    </Card>
  );
}

export default function HomeScreen() {
  const { conventions, addConvention } = useConventions();
  const [showForm, setShowForm] = useState(false);

  async function handleAdd(convention: Omit<Convention, "id">) {
    await addConvention(convention);
    setShowForm(false);
  }

  return (
    <View className="flex-1 bg-white dark:bg-black">
      {conventions.length === 0 && !showForm ? (
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-5xl">🐾</Text>
          <Text className="mt-4 text-xl font-semibold text-gray-900 dark:text-white">
            No conventions yet
          </Text>
          <Text className="mt-2 text-center text-gray-500 dark:text-gray-400">
            Want to add a convention? Import a schedule via iCal or add one
            manually.
          </Text>
          <View className="mt-6">
            <Button onPress={() => setShowForm(true)}>Add Convention</Button>
          </View>
        </View>
      ) : (
        <FlatList
          data={conventions}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <ConventionCard convention={item} />}
          contentContainerStyle={{ paddingVertical: 16, gap: 12 }}
          ListHeaderComponent={
            showForm ? (
              <AddConventionForm
                onAdd={handleAdd}
                onCancel={() => setShowForm(false)}
              />
            ) : null
          }
          ListFooterComponent={
            !showForm && conventions.length > 0 ? (
              <View className="mx-4 mt-2">
                <Button variant="outline" onPress={() => setShowForm(true)}>
                  Add Convention
                </Button>
              </View>
            ) : null
          }
        />
      )}
    </View>
  );
}
