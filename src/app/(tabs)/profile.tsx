import { Platform, ScrollView, Text, View } from "react-native";
import { useAuth } from "@/hooks/use-auth";
import { usePremium } from "@/hooks/use-premium";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function SignedOutView() {
  const { signInWithGoogle, signInWithApple } = useAuth();

  return (
    <View className="flex-1 items-center justify-center px-8">
      <Text className="text-5xl">👤</Text>
      <Text className="mt-4 text-xl font-semibold text-gray-900 dark:text-white">
        Sign in to see your profile
      </Text>
      <Text className="mt-2 text-center text-gray-500 dark:text-gray-400">
        Create an account to sync your profile and conventions.
      </Text>
      <View className="mt-6 w-full gap-3">
        {Platform.OS === "ios" && (
          <Button variant="secondary" onPress={signInWithApple}>
            Continue with Apple
          </Button>
        )}
        <Button variant="secondary" onPress={signInWithGoogle}>
          Continue with Google
        </Button>
      </View>
    </View>
  );
}

export default function ProfileScreen() {
  const { user, profile } = useAuth();
  const { premium } = usePremium();

  if (!user || !profile) {
    return (
      <View className="flex-1 bg-white dark:bg-black">
        <SignedOutView />
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-white dark:bg-black">
      <View className="items-center px-8 pt-8">
        <Avatar
          name={profile.displayName || profile.username}
          size="lg"
        />

        <View className="mt-4 flex-row items-center gap-2">
          <Text className="text-xl font-bold text-gray-900 dark:text-white">
            {profile.displayName || profile.username}
          </Text>
          {profile.verified && <Badge variant="verified">Verified</Badge>}
        </View>

        <Text className="mt-1 text-gray-500 dark:text-gray-400">
          @{profile.username}
        </Text>

        {profile.pronouns ? (
          <Text className="mt-1 text-sm text-gray-400 dark:text-gray-500">
            {profile.pronouns}
          </Text>
        ) : null}

        {premium.isActive && (
          <Badge variant="premium" className="mt-2">
            Paw Pass
          </Badge>
        )}
      </View>

      {profile.bio ? (
        <Card className="mx-4 mt-6">
          <CardHeader>
            <CardTitle>About</CardTitle>
          </CardHeader>
          <CardContent>
            <Text className="text-gray-700 dark:text-gray-300">
              {profile.bio}
            </Text>
          </CardContent>
        </Card>
      ) : null}

      <Card className="mx-4 mt-4 mb-8">
        <CardHeader>
          <CardTitle>Next Conventions</CardTitle>
        </CardHeader>
        <CardContent>
          <Text className="text-gray-500 dark:text-gray-400">
            No upcoming conventions linked to your profile yet.
          </Text>
        </CardContent>
      </Card>
    </ScrollView>
  );
}
