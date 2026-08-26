import { execFileSync } from "node:child_process";
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
 * Build number, counted from git history.
 *
 * Apple and Google both reject an upload whose build number repeats one already
 * seen for the same marketing version, and forgetting to bump it by hand is the
 * usual way that happens. EAS solves this with a remote counter, but only for
 * builds that run on EAS -- a local Xcode or Gradle build never touches it, and
 * would otherwise stamp every archive with the Expo default of 1. The second
 * TestFlight upload would then be rejected as a duplicate.
 *
 * Commit count is monotonic on a branch, needs nothing kept in sync by hand, and
 * ties any build back to the exact commit it came from. It falls back to 1 when
 * git is unavailable, which covers a tarball checkout and a shallow CI clone;
 * neither of those uploads to a store, so a low number there is harmless.
 */
const getBuildNumber = (): number => {
  try {
    const count = execFileSync("git", ["rev-list", "--count", "HEAD"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    return Number.parseInt(count, 10) || 1;
  } catch {
    return 1;
  }
};

const BUILD_NUMBER = getBuildNumber();

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
      usesNonExemptEncryption: false,
    },
  },
  android: {
    icon: getVariantPng("icon"),
    versionCode: BUILD_NUMBER,
    permissions: ["android.permission.SCHEDULE_EXACT_ALARM"],
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
    "expo-document-picker",
    "expo-sharing",
    "expo-web-browser",
    ...(APP_VARIANT === "development" ? [] : ["@sentry/react-native/expo"]),
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
});
