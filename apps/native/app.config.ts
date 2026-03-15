import type { ConfigContext, ExpoConfig } from "expo/config";

const APP_VARIANT = process.env.APP_VARIANT ?? "production";

const getAppName = (): string => {
  switch (APP_VARIANT) {
    case "development":
      return "ConPaws (Dev)";
    case "preview":
      return "ConPaws (Preview)";
    default:
      return "ConPaws";
  }
};

const getBundleId = (): string => {
  switch (APP_VARIANT) {
    case "development":
      return "com.mrdemonwolf.conpaws.dev";
    case "preview":
      return "com.mrdemonwolf.conpaws.preview";
    default:
      return "com.mrdemonwolf.conpaws";
  }
};

const getScheme = (): string => {
  switch (APP_VARIANT) {
    case "development":
      return "conpaws-dev";
    case "preview":
      return "conpaws-preview";
    default:
      return "conpaws";
  }
};

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: getAppName(),
  slug: "conpaws",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/images/icon.png",
  scheme: getScheme(),
  userInterfaceStyle: "automatic",
  ios: {
    supportsTablet: true,
    bundleIdentifier: getBundleId(),
    associatedDomains: ["applinks:conpaws.app"],
    infoPlist: {
      NSCameraUsageDescription:
        "ConPaws needs access to your camera to take photos.",
      NSPhotoLibraryUsageDescription:
        "ConPaws needs access to your photo library to select photos.",
      NSPhotoLibraryAddUsageDescription:
        "ConPaws needs permission to save photos to your library.",
    },
  },
  android: {
    adaptiveIcon: {
      backgroundColor: "#E6F4FE",
      foregroundImage: "./assets/images/android-icon-foreground.png",
      backgroundImage: "./assets/images/android-icon-background.png",
      monochromeImage: "./assets/images/android-icon-monochrome.png",
    },
    package: getBundleId(),
    permissions: [
      "CAMERA",
      "READ_EXTERNAL_STORAGE",
      "WRITE_EXTERNAL_STORAGE",
      "RECEIVE_BOOT_COMPLETED",
      "VIBRATE",
    ],
    enableEdgeToEdge: true,
  },
  androidStatusBar: {
    translucent: true,
  },
  web: {
    output: "static",
    favicon: "./assets/images/favicon.png",
  },
  plugins: [
    "expo-router",
    "expo-sqlite",
    "expo-localization",
    "expo-notifications",
    [
      "expo-splash-screen",
      {
        image: "./assets/images/splash-icon.png",
        imageWidth: 200,
        resizeMode: "contain",
        backgroundColor: "#ffffff",
        dark: {
          backgroundColor: "#000000",
        },
      },
    ],
    "expo-document-picker",
    "@sentry/react-native/expo",
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
});
