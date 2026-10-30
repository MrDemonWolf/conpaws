const { getSentryExpoConfig } = require("@sentry/react-native/metro");
const { withNativeWind } = require("nativewind/metro");

const config = getSentryExpoConfig(__dirname);

module.exports = withNativeWind(config, {
  // These roles are supplied from the same seeded Material 3 palette as Expo
  // UI Hosts on Android. Keep them as runtime variables instead of inlining
  // the static fallback values from global.css into NativeWind utilities.
  inlineVariables: {
    exclude: [
      "--color-background",
      "--color-foreground",
      "--color-card",
      "--color-card-foreground",
      "--color-secondary",
      "--color-secondary-foreground",
      "--color-muted",
      "--color-muted-foreground",
      "--color-accent",
      "--color-accent-foreground",
      "--color-border",
      "--color-input",
    ],
  },
});
