import { Alert, ScrollView, Text, View } from "react-native";
import { useAuth } from "@/hooks/use-auth";
import { useOnboarding } from "@/hooks/use-onboarding";
import { usePremium } from "@/hooks/use-premium";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function SettingsScreen() {
  const { user, signOut } = useAuth();
  const { resetOnboarding } = useOnboarding();
  const { premium, restore } = usePremium();

  function handleResetOnboarding() {
    Alert.alert(
      "Reset Onboarding",
      "This will restart the onboarding flow. Are you sure?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset",
          style: "destructive",
          onPress: resetOnboarding,
        },
      ],
    );
  }

  function handleSignOut() {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: signOut,
      },
    ]);
  }

  return (
    <ScrollView className="flex-1 bg-white dark:bg-black">
      <View className="gap-4 p-4">
        {/* Paw Pass */}
        <Card>
          <CardHeader>
            <View className="flex-row items-center justify-between">
              <CardTitle>Paw Pass</CardTitle>
              {premium.isActive ? (
                <Badge variant="premium">Active</Badge>
              ) : (
                <Badge variant="secondary">Free</Badge>
              )}
            </View>
          </CardHeader>
          <CardContent className="gap-3">
            {premium.isActive ? (
              <Text className="text-gray-500 dark:text-gray-400">
                You have an active Paw Pass subscription. Enjoy sharing your
                schedule and profile!
              </Text>
            ) : (
              <>
                <Text className="text-gray-500 dark:text-gray-400">
                  Upgrade to Paw Pass to share your convention schedule and get a
                  shareable profile link.
                </Text>
                <Button variant="secondary">Subscribe — $2.99/mo</Button>
              </>
            )}
            <Button variant="ghost" onPress={restore}>
              Restore Purchases
            </Button>
          </CardContent>
        </Card>

        {/* Account */}
        <Card>
          <CardHeader>
            <CardTitle>Account</CardTitle>
          </CardHeader>
          <CardContent className="gap-3">
            {user ? (
              <>
                <Text className="text-gray-500 dark:text-gray-400">
                  Signed in as {user.email}
                </Text>
                <Button variant="destructive" onPress={handleSignOut}>
                  Sign Out
                </Button>
              </>
            ) : (
              <Text className="text-gray-500 dark:text-gray-400">
                Not signed in. Go to Profile to create an account.
              </Text>
            )}
          </CardContent>
        </Card>

        {/* App */}
        <Card>
          <CardHeader>
            <CardTitle>App</CardTitle>
          </CardHeader>
          <CardContent className="gap-3">
            <Button variant="outline" onPress={handleResetOnboarding}>
              Reset Onboarding
            </Button>
          </CardContent>
        </Card>
      </View>
    </ScrollView>
  );
}
