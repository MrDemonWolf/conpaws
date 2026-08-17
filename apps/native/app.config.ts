import type { ConfigContext, ExpoConfig } from "expo/config";

const APP_VARIANT = process.env.APP_VARIANT ?? "production";
const EAS_PROJECT_ID = "0ad7171c-1b3e-48b2-a806-554aeea30048";

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
  owner: "mrdemonwolf-org",
  version: "1.0.0",
  orientation: "default",
  icon: "./assets/images/icon.png",
  scheme: getScheme(),
  extra: {
    eas: {
      projectId: EAS_PROJECT_ID,
    },
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: getBundleId(),
    associatedDomains: ["applinks:conpaws.com"],
    config: {
      usesNonExemptEncryption: false,
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
    // `enableEdgeToEdge` was removed in SDK 55 — edge-to-edge is always on.
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
