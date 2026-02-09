import { ConfigContext, ExpoConfig } from "expo/config";

const APP_VARIANT = process.env.APP_VARIANT || "development";

const getBundleId = () => {
  switch (APP_VARIANT) {
    case "production":
      return "com.mrdemonwolf.conpaws";
    default:
      return "com.mrdemonwolf.conpaws.dev";
  }
};

const getIcon = () => {
  return "./src/assets/images/icon.png";
};

const getAndroidForegroundIcon = () => {
  return "./src/assets/images/android-icon-foreground.png";
};

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "ConPaws",
  slug: "conpaws",
  version: "1.0.0",
  orientation: "portrait",
  icon: getIcon(),
  scheme: "conpaws",
  userInterfaceStyle: "automatic",
  newArchEnabled: true,
  ios: {
    supportsTablet: true,
    bundleIdentifier: getBundleId(),
    infoPlist: {
      NSMotionUsageDescription:
        "This app uses haptic feedback to enhance your experience.",
    },
  },
  android: {
    package: getBundleId(),
    adaptiveIcon: {
      backgroundColor: "#E6F4FE",
      foregroundImage: getAndroidForegroundIcon(),
      backgroundImage: "./src/assets/images/android-icon-background.png",
      monochromeImage: "./src/assets/images/android-icon-monochrome.png",
    },
    edgeToEdgeEnabled: true,
  },
  web: {
    output: "static",
    favicon: "./src/assets/images/favicon.png",
  },
  plugins: [
    "expo-router",
    [
      "expo-splash-screen",
      {
        image: "./src/assets/images/splash-icon.png",
        imageWidth: 200,
        resizeMode: "contain",
        backgroundColor: "#ffffff",
        dark: {
          backgroundColor: "#000000",
        },
      },
    ],
  ],
  extra: {
    eas: {
      projectId: "0ad7171c-1b3e-48b2-a806-554aeea30048",
    },
  },
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
});
