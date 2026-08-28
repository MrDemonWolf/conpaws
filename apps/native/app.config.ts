import type { ConfigContext, ExpoConfig } from "expo/config";

const APP_VARIANT = process.env.APP_VARIANT ?? "production";
const EAS_PROJECT_ID = "0ad7171c-1b3e-48b2-a806-554aeea30048";

if (!["development", "preview", "production"].includes(APP_VARIANT)) {
  throw new Error(`Invalid APP_VARIANT: ${APP_VARIANT}`);
}

const getBundleId = (): string => {
  return APP_VARIANT === "development"
    ? "com.mrdemonwolf.conpaws.dev"
    : "com.mrdemonwolf.conpaws";
};

const getScheme = (): string => {
  return APP_VARIANT === "development" ? "conpaws-dev" : "conpaws";
};

/**
 * Build number, bumped by hand at release time.
 *
 * This used to be derived from `git rev-list --count HEAD`, which drifted: the
 * count reached 208 while the shipped build was 203, because not every commit
 * produces a build. A number that looks authoritative and is wrong is worse than
 * one that has to be typed.
 *
 * EAS builds ignore this entirely -- eas.json sets `appVersionSource: "remote"`,
 * so the remote counter wins there. It matters for the local Xcode Organizer
 * archive that RELEASING.md describes, which is how ConPaws has actually shipped
 * so far: prebuild writes this into CFBundleVersion and versionCode, and leaving
 * it unset would stamp the archive with Expo's default of 1 and get the upload
 * rejected as a duplicate of a lower build.
 *
 * Bump it in the same commit that tags the release.
 */
const BUILD_NUMBER = 204;

const getVariantPng = (name: string): string =>
  `./assets/images/${name}${APP_VARIANT === "development" ? "-development" : ""}.png`;

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "ConPaws",
  slug: "conpaws",
  owner: "mrdemonwolf-org",
  version: "1.0.0",
  orientation: "default",
  userInterfaceStyle: "automatic",
  icon: getVariantPng("icon"),
  scheme: getScheme(),
  extra: {
    appVariant: APP_VARIANT,
    eas: {
      projectId: EAS_PROJECT_ID,
      build: {
        experimental: {
          ios: {
            appExtensions: [
              {
                targetName: "widget",
                bundleIdentifier: `${getBundleId()}.widgets`,
                entitlements: {
                  "com.apple.security.application-groups": [
                    `group.${getBundleId()}`,
                  ],
                },
              },
              {
                targetName: "ConPawsWatch",
                bundleIdentifier: `${getBundleId()}.watchkitapp`,
                entitlements: {
                  "com.apple.security.application-groups": [
                    `group.${getBundleId()}`,
                  ],
                },
              },
              {
                targetName: "ConPawsWatchWidgetExtension",
                bundleIdentifier: `${getBundleId()}.watchkitapp.widgets`,
                entitlements: {
                  "com.apple.security.application-groups": [
                    `group.${getBundleId()}`,
                  ],
                },
              },
            ],
          },
        },
      },
    },
  },
  ios: {
    appleTeamId: "HBB7T99U79",
    buildNumber: String(BUILD_NUMBER),
    icon:
      APP_VARIANT === "development"
        ? "./assets/images/ConPaws-development.icon"
        : "./assets/images/ConPaws.icon",
    supportsTablet: true,
    bundleIdentifier: getBundleId(),
    entitlements: {
      "com.apple.security.application-groups": [`group.${getBundleId()}`],
    },
    privacyManifests: {
      NSPrivacyAccessedAPITypes: [
        {
          NSPrivacyAccessedAPIType: "NSPrivacyAccessedAPICategoryUserDefaults",
          NSPrivacyAccessedAPITypeReasons: ["1C8F.1"],
        },
      ],
    },
    config: {
      // ConPaws only talks HTTPS, which is exempt encryption under US export
      // rules, so it needs no export compliance documentation. This writes
      // ITSAppUsesNonExemptEncryption into Info.plist; without it App Store
      // Connect asks the export question on every upload and holds the build.
      usesNonExemptEncryption: false,
    },
  },
  android: {
    icon: getVariantPng("icon"),
    versionCode: BUILD_NUMBER,
    permissions: ["android.permission.SCHEDULE_EXACT_ALARM"],
    // Permissions no ConPaws code path uses, removed from the merged manifest so
    // they never reach the Play listing or the Android app-info screen.
    //
    // The location pair comes from expo-location -- both its own library
    // manifest and its config plugin add it unconditionally. ConPaws only ever
    // forward-geocodes a city the user typed, and Android refuses to geocode at
    // all without a granted foreground-location permission, which ConPaws
    // deliberately never asks for (see the expo-location plugin entry below).
    // Removing the declarations therefore changes nothing at runtime: the
    // permission was already ungranted, and iOS geocoding needs no permission.
    //
    // The other three are Expo's bare-template "optional permissions" block.
    // File access here goes through the document picker and the app's own cache
    // directory, neither of which needs external storage, and the only thing
    // that wants SYSTEM_ALERT_WINDOW is React Native's debug FPS overlay -- a
    // dev-only tool, and not worth a "display over other apps" line on a store
    // listing.
    blockedPermissions: [
      "android.permission.ACCESS_COARSE_LOCATION",
      "android.permission.ACCESS_FINE_LOCATION",
      "android.permission.READ_EXTERNAL_STORAGE",
      "android.permission.SYSTEM_ALERT_WINDOW",
      "android.permission.WRITE_EXTERNAL_STORAGE",
    ],
    adaptiveIcon: {
      foregroundImage: getVariantPng("android-icon-foreground"),
      backgroundImage: "./assets/images/android-icon-background.png",
      monochromeImage: getVariantPng("android-icon-monochrome"),
    },
    package: getBundleId(),
    // Edge-to-edge is always enabled in Expo SDK 57.
    // Opts into the Android 13+ back-preview animation. Expo's prebuild default
    // is `android:enableOnBackInvokedCallback="false"`, which switches it off
    // entirely. Safe to enable only because every form now guards its own exit
    // through useUnsavedChangesGuard -- without that, an easier-to-trigger back
    // gesture would just make silent data loss easier to trigger too.
    predictiveBackGestureEnabled: true,
  },
  web: {
    output: "static",
    favicon: "./assets/images/favicon.png",
  },
  plugins: [
    "expo-router",
    "@bacons/apple-targets",
    "expo-sqlite",
    // expo-location is autolinked, so this entry exists only to pass props. Left
    // at its defaults the plugin writes four purpose strings into Info.plist --
    // three location ones, including background "Always", plus Motion &
    // Fitness -- all carrying its placeholder text. ConPaws raises none of those
    // prompts: it calls Location.geocodeAsync on a typed city, which needs no
    // authorization on iOS. A purpose string for a prompt the app cannot show is
    // what App Review asks about under 5.1.1, so `false` deletes each key.
    [
      "expo-location",
      {
        locationAlwaysAndWhenInUsePermission: false,
        locationAlwaysPermission: false,
        locationWhenInUsePermission: false,
        motionUsagePermission: false,
      },
    ],
    [
      "expo-localization",
      {
        supportedLocales: {
          ios: ["en", "de", "es", "fr", "nl", "pl", "pt-BR", "sv"],
          android: ["en", "de", "es", "fr", "nl", "pl", "pt-BR", "sv"],
        },
      },
    ],
    [
      "expo-notifications",
      {
        icon: "./assets/images/notification-icon.png",
        color: "#0FACED",
      },
    ],
    [
      "expo-splash-screen",
      {
        image: "./assets/images/splash-icon.png",
        imageWidth: 200,
        resizeMode: "contain",
        backgroundColor: "#ffffff",
        dark: {
          backgroundColor: "#091533",
        },
      },
    ],
    // expo-dev-launcher writes NSLocalNetworkUsageDescription and the
    // _expo._tcp Bonjour service at prebuild, and its own "Strip Local Network
    // Keys for Release" build phase fails to take them back out again -- build
    // 204's Release archive shipped both. The development variant keeps them,
    // because that is the build that talks to Metro.
    ...(APP_VARIANT === "development"
      ? []
      : ["./plugins/withoutDevLauncherLocalNetwork.js"]),
    "expo-document-picker",
    "expo-sharing",
    "expo-web-browser",
    // Org and project are not secret; naming them here writes sentry.properties
    // at prebuild so a local Xcode/Gradle build finds them without relying on
    // which .env file the bundler happened to load. The auth token stays in the
    // SENTRY_AUTH_TOKEN environment variable and is never committed.
    ...(APP_VARIANT === "development"
      ? []
      : [
          [
            "@sentry/react-native/expo",
            { organization: "mrdemonwolf", project: "conpaws" },
          ] as [string, Record<string, string>],
        ]),
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
});
