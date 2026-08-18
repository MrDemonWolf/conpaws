import Constants from "expo-constants";
import { Redirect } from "expo-router";
import { useState } from "react";
import { ScrollView, View } from "react-native";
import { OnboardingButton } from "@/components/OnboardingButton";
import {
  Badge,
  Button,
  Card,
  Input,
  Separator,
  Switch,
  Text,
} from "@/components/ui";
import { developerToolsEnabled } from "@/lib/developer-tools";

export default function UiSystemScreen() {
  const [switchValue, setSwitchValue] = useState(true);
  const enabled = developerToolsEnabled(
    __DEV__,
    Constants.expoConfig?.extra?.appVariant,
  );

  if (!enabled) return <Redirect href="/(tabs)/settings" />;

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ gap: 20, padding: 16, paddingBottom: 32 }}
      keyboardShouldPersistTaps="handled"
    >
      <View className="gap-2">
        <Text variant="h1">Heading 1</Text>
        <Text variant="h2">Heading 2</Text>
        <Text variant="h3">Heading 3</Text>
        <Text variant="body">Body text</Text>
        <Text variant="label">Label text</Text>
        <Text variant="caption" className="text-muted-foreground">
          Caption text
        </Text>
      </View>

      <Separator />

      <View className="gap-3">
        <Text variant="h3">Native onboarding controls</Text>
        <OnboardingButton label="Primary" onPress={() => undefined} />
        <OnboardingButton
          label="Secondary"
          variant="secondary"
          onPress={() => undefined}
        />
        <OnboardingButton
          label="Text"
          variant="text"
          onPress={() => undefined}
        />
      </View>

      <View className="gap-3">
        <Text variant="h3">App controls</Text>
        <Button onPress={() => undefined}>Default</Button>
        <Button variant="outline" onPress={() => undefined}>
          Outline
        </Button>
        <Button disabled onPress={() => undefined}>
          Disabled
        </Button>
        <Button loading onPress={() => undefined}>
          Loading
        </Button>
        <Input label="Input" placeholder="Type here" returnKeyType="done" />
        <Input label="Input error" value="Invalid" error="Check this value" />
        <View className="flex-row items-center justify-between">
          <Text variant="body">System switch</Text>
          <Switch
            value={switchValue}
            onValueChange={setSwitchValue}
            accessibilityLabel="System switch preview"
          />
        </View>
      </View>

      <Card className="gap-3 p-4">
        <Text variant="h3">Card and status</Text>
        <Text variant="body" className="text-muted-foreground">
          Semantic surfaces follow light and dark appearance.
        </Text>
        <View className="flex-row flex-wrap gap-2">
          <Badge variant="upcoming" label="Upcoming" />
          <Badge variant="active" label="Active" />
          <Badge variant="ended" label="Ended" />
        </View>
      </Card>
    </ScrollView>
  );
}
