// Expo app config using EAS environment variables
const IS_DEV = process.env.APP_VARIANT === "development";
const IS_PREVIEW = process.env.APP_VARIANT === "preview";

const getUniqueIdentifier = () => {
  if (IS_DEV) {
    return "com.mrdemonwolf.ConPaws.dev";
  }
  if (IS_PREVIEW) {
    return "com.mrdemonwolf.ConPaws.preview";
  }
  return "com.mrdemonwolf.ConPaws";
};

const getAppName = () => {
  if (IS_DEV) {
    return "ConPaws (Dev)";
  }
  if (IS_PREVIEW) {
    return "ConPaws (Preview)";
  }
  return "ConPaws";
};

export default {
  name: getAppName(),
  slug: "conpaws",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/images/icon.png",
  scheme: "conpaws",
  userInterfaceStyle: "automatic",
  newArchEnabled: true,
  ios: {
    supportsTablet: true,
    bundleIdentifier: getUniqueIdentifier(),
    icon: "./assets/conpaws-ios.icon",
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  android: {
    adaptiveIcon: {
      backgroundColor: "#E6F4FE",
      foregroundImage: "./assets/images/android-icon-foreground.png",
      backgroundImage: "./assets/images/android-icon-background.png",
      monochromeImage: "./assets/images/android-icon-monochrome.png",
    },
    edgeToEdgeEnabled: true,
    predictiveBackGestureEnabled: false,
    intentFilters: [
      {
        action: "VIEW",
        data: [
          {
            scheme: "conpaws",
          },
        ],
        category: ["BROWSABLE", "DEFAULT"],
      },
    ],
    package: getUniqueIdentifier(),
  },
  plugins: [
    "expo-router",
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
    [
      "@sentry/react-native/expo",
      {
        url: "https://sentry.io/",
        project: "conpaws",
        organization: "mrdemonwolf",
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
  expo: {
    extra: {
      eas: {
        projectId: "5ebfc6c8-9a9a-4bef-9c73-40319c9eb559",
      },
    },
  },
  owner: "mrdemonwolf-org",
};
