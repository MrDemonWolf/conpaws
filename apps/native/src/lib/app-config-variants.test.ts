import type { ConfigContext } from "expo/config";
import { afterEach, describe, expect, it, vi } from "vitest";

const loadConfig = async (
  variant: "development" | "preview" | "production",
) => {
  vi.resetModules();
  vi.stubEnv("APP_VARIANT", variant);
  const { default: createConfig } = await import("../../app.config");
  return createConfig({ config: {} } as ConfigContext);
};

afterEach(() => vi.unstubAllEnvs());

describe("app variants", () => {
  it.each([
    {
      variant: "development" as const,
      bundleId: "com.mrdemonwolf.conpaws.dev",
      scheme: "conpaws-dev",
      icon: "./assets/images/icon-development.png",
      iosIcon: "./assets/images/ConPaws-development.icon",
      foreground: "./assets/images/android-icon-foreground-development.png",
      monochrome: "./assets/images/android-icon-monochrome-development.png",
    },
    {
      variant: "preview" as const,
      bundleId: "com.mrdemonwolf.conpaws",
      scheme: "conpaws",
      icon: "./assets/images/icon.png",
      iosIcon: "./assets/images/ConPaws.icon",
      foreground: "./assets/images/android-icon-foreground.png",
      monochrome: "./assets/images/android-icon-monochrome.png",
    },
    {
      variant: "production" as const,
      bundleId: "com.mrdemonwolf.conpaws",
      scheme: "conpaws",
      icon: "./assets/images/icon.png",
      iosIcon: "./assets/images/ConPaws.icon",
      foreground: "./assets/images/android-icon-foreground.png",
      monochrome: "./assets/images/android-icon-monochrome.png",
    },
  ])("uses the $variant identity and icon", async (expected) => {
    const config = await loadConfig(expected.variant);

    expect(config.name).toBe("ConPaws");
    expect(config.extra?.appVariant).toBe(expected.variant);
    expect(config.ios?.bundleIdentifier).toBe(expected.bundleId);
    expect(config.android?.package).toBe(expected.bundleId);
    expect(config.scheme).toBe(expected.scheme);
    expect(config.icon).toBe(expected.icon);
    expect(config.android?.adaptiveIcon?.foregroundImage).toBe(
      expected.foreground,
    );
    expect(config.android?.adaptiveIcon?.monochromeImage).toBe(
      expected.monochrome,
    );
    expect(config.ios?.icon).toBe(expected.iosIcon);
    expect(config.extra?.eas.build.experimental.ios.appExtensions).toEqual(
      ["widget", "ConPawsWatch", "ConPawsWatchWidgetExtension"].map(
        (targetName, index) => ({
          targetName,
          bundleIdentifier: `${expected.bundleId}${
            [".widgets", ".watchkitapp", ".watchkitapp.widgets"][index]
          }`,
          entitlements: {
            "com.apple.security.application-groups": [
              `group.${expected.bundleId}`,
            ],
          },
        }),
      ),
    );
  });
});
