import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { XcodeProject } from "@bacons/xcode";

const require = createRequire(import.meta.url);
const { getConfig } = require("expo/config");
const { AndroidConfig, IOSConfig } = require("expo/config-plugins");
const appRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const { exp } = getConfig(appRoot);
const bundleId = exp.ios.bundleIdentifier;
const project = XcodeProject.open(IOSConfig.Paths.getPBXProjectPath(appRoot));
const targets = project.rootObject.props.targets;
const baseBundleId = bundleId.replace(/\.dev$/, "");
assert(
  !targets.some(
    (target) =>
      target.props.name === "widget" &&
      [`${baseBundleId}.widgets`, `${baseBundleId}.dev.widgets`].includes(
        target.getDefaultBuildSetting("PRODUCT_BUNDLE_IDENTIFIER"),
      ),
  ),
  "A legacy ConPaws phone widget target remains active",
);

for (const [name, suffix] of [
  ["ExpoWidgetsTarget", ".widgets"],
  ["ConPawsWatch", ".watchkitapp"],
  ["ConPawsWatchWidgetExtension", ".watchkitapp.widgets"],
]) {
  const matching = targets.filter(
    (target) =>
      target.getDefaultBuildSetting("PRODUCT_BUNDLE_IDENTIFIER") ===
      `${bundleId}${suffix}`,
  );
  assert.equal(matching.length, 1, `${suffix} must have exactly one target`);
  assert.equal(
    matching[0].props.name,
    name,
    `${suffix} target identity changed`,
  );
  if (name === "ExpoWidgetsTarget") {
    assert.equal(
      matching[0].getDefaultBuildSetting("IPHONEOS_DEPLOYMENT_TARGET"),
      "17.0",
      "The existing AppIntent widget requires iOS 17",
    );
  }
}

const extensionRoot = path.join(appRoot, "ios/ExpoWidgetsTarget");
const swift = readFileSync(
  path.join(extensionRoot, "ConPawsWidget.swift"),
  "utf8",
);
assert(swift.includes('let name: String = "ConPawsWidget"'));
assert.deepEqual(
  swift
    .match(/\.supportedFamilies\(\[([^\]]+)\]\)/)[1]
    .split(",")
    .map((family) => family.trim().replace(/^\./, "")),
  [
    "systemSmall",
    "systemMedium",
    "systemLarge",
    "accessoryCircular",
    "accessoryRectangular",
    "accessoryInline",
  ],
);
for (const family of [
  "systemSmall",
  "systemMedium",
  "systemLarge",
  "accessoryCircular",
  "accessoryRectangular",
  "accessoryInline",
]) {
  assert(swift.includes(`.${family}`), `Missing ${family} widget family`);
}
assert(swift.includes("ConPawsWidgetConventionOptionsProvider"));
for (const identifier of ["ConPawsWidgetIntent", "ConPawsWidgetMode"]) {
  assert(
    swift.includes(`static let persistentIdentifier = "${identifier}"`),
    `Widgets pinned before the Expo migration need the ${identifier} identity`,
  );
}
assert(swift.includes("case automatic"));
assert(swift.includes("case countdown"));
assert(swift.includes("case nextEvent"));
assert(
  readFileSync(
    path.join(extensionRoot, "ExpoWidgetsTarget.entitlements"),
    "utf8",
  ).includes(`group.${bundleId}`),
);
assert(
  readFileSync(
    path.join(extensionRoot, "PrivacyInfo.xcprivacy"),
    "utf8",
  ).includes("NSPrivacyAccessedAPICategoryUserDefaults"),
);
assert.deepEqual(
  readFileSync(path.join(extensionRoot, "PrivacyInfo.xcprivacy")),
  readFileSync(path.join(appRoot, "src/widgets/PrivacyInfo.xcprivacy")),
  "The generated extension must bundle the canonical widget privacy manifest",
);
const resources = targets
  .find((target) => target.props.name === "ExpoWidgetsTarget")
  .getResourcesBuildPhase().props.files;
assert.equal(
  resources.filter((file) =>
    file.props.fileRef?.props.path?.endsWith("PrivacyInfo.xcprivacy"),
  ).length,
  1,
  "The widget must bundle its privacy manifest exactly once",
);

const androidRoot = path.join(appRoot, "android/app/src/main");
const provider = readFileSync(
  path.join(
    androidRoot,
    "java",
    ...exp.android.package.split("."),
    "ConPawsWidgetProvider.kt",
  ),
  "utf8",
);
assert(
  provider.includes("ConPawsWidgetProvider : ConPawsExpoWidgetProvider()"),
);
const widgetInfo = readFileSync(
  path.join(androidRoot, "res/xml/con_paws_widget_info.xml"),
  "utf8",
);
assert(widgetInfo.includes('android:updatePeriodMillis="1800000"'));
assert(widgetInfo.includes('android:minResizeHeight="220dp"'));
assert(widgetInfo.includes('android:minHeight="220dp"'));
assert(widgetInfo.includes('android:targetCellHeight="3"'));
assert(
  readFileSync(path.join(appRoot, "android/build.gradle"), "utf8").includes(
    "fileTree(new File(rootDir, '../src/widgets'))",
  ),
  "Android must track widget renderer and helper changes as layout inputs",
);
const manifest = await AndroidConfig.Manifest.readAndroidManifestAsync(
  path.join(androidRoot, "AndroidManifest.xml"),
);
const receiver = AndroidConfig.Manifest.getMainApplicationOrThrow(
  manifest,
).receiver?.filter(
  (entry) => entry.$["android:name"] === ".ConPawsWidgetProvider",
);
assert.equal(receiver?.length, 1);
assert.equal(receiver[0].$["android:exported"], "false");
console.log(
  "Widget and Watch target identities, privacy, families and Android bridge verified.",
);
