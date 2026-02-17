import type { ExpoConfig, ConfigContext } from "expo/config";

const IS_DEV = process.env.APP_VARIANT === "development" || !process.env.APP_VARIANT;
const IS_PREVIEW = process.env.APP_VARIANT === "preview";

const getAppName = () => {
  if (IS_DEV) return "ConPaws (Dev)";
  if (IS_PREVIEW) return "ConPaws (Preview)";
  return "ConPaws";
};

const getBundleId = () => {
  if (IS_DEV) return "com.mrdemonwolf.conpaws.dev";
  if (IS_PREVIEW) return "com.mrdemonwolf.conpaws.preview";
  return "com.mrdemonwolf.conpaws";
};

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: getAppName(),
  slug: "conpaws",
  version: "0.1.0",
  orientation: "portrait",
  icon: "./src/assets/images/icon.png",
  scheme: "conpaws",
  userInterfaceStyle: "automatic",
  newArchEnabled: false,
  splash: {
    image: "./src/assets/images/splash-icon.png",
    resizeMode: "contain",
    backgroundColor: "#6D28D9",
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: getBundleId(),
  },
  android: {
    adaptiveIcon: {
      foregroundImage: "./src/assets/images/android-icon-foreground.png",
      backgroundColor: "#6D28D9",
    },
    package: getBundleId(),
  },
  web: {
    bundler: "metro",
    output: "single",
    favicon: "./src/assets/images/favicon.png",
  },
  plugins: [
    "expo-router",
    "expo-sqlite",
    "expo-splash-screen",
    "expo-document-picker",
    "expo-font",
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
  extra: {
    eas: {
      projectId: "your-project-id",
    },
    appVariant: process.env.APP_VARIANT ?? "development",
  },
});
