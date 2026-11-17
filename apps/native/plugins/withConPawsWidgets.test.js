import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { XcodeProject } from "@bacons/xcode";
import { build } from "@bacons/xcode/json";
import { describe, expect, it } from "vitest";
import xcode from "xcode";
import parser from "xcode/lib/parser/pbxproj";
import withConPawsWidgets, {
  addWidgetPrivacyManifest,
  patchAndroidBuildGradle,
  patchAndroidProvider,
  patchAndroidWidgetInfo,
  removeLegacyWidgetTarget,
  syncWidgetBuildSettings,
} from "./withConPawsWidgets.js";

function projectFixture() {
  const objects = {
    ROOT: {
      isa: "PBXProject",
      targets: [],
      mainGroup: "GROUP",
      buildConfigurationList: "PROJECTCONFIG",
    },
    GROUP: { isa: "PBXGroup", children: ["SHARED"], sourceTree: "<group>" },
    SHARED: {
      isa: "PBXFileSystemSynchronizedRootGroup",
      path: "../targets/_shared",
      sourceTree: "<group>",
      exceptions: ["OLDEXCEPTION", "WATCHEXCEPTION"],
    },
    OLDEXCEPTION: {
      isa: "PBXFileSystemSynchronizedBuildFileExceptionSet",
      target: "OLD",
      membershipExceptions: ["Info.plist"],
    },
    WATCHEXCEPTION: {
      isa: "PBXFileSystemSynchronizedBuildFileExceptionSet",
      target: "WATCH",
      membershipExceptions: ["Info.plist"],
    },
    PROJECTCONFIG: {
      isa: "XCConfigurationList",
      buildConfigurations: [],
      defaultConfigurationName: "Release",
    },
  };
  for (const [id, name, bundle] of [
    ["OLD", "widget", "com.mrdemonwolf.conpaws.widgets"],
    ["WATCH", "ConPawsWatch", "com.mrdemonwolf.conpaws.watchkitapp"],
    [
      "COMPLICATION",
      "ConPawsWatchWidgetExtension",
      "com.mrdemonwolf.conpaws.watchkitapp.widgets",
    ],
    ["UNRELATED", "widget", "com.example.other.widgets"],
  ]) {
    objects.ROOT.targets.push(id);
    objects[id] = {
      isa: "PBXNativeTarget",
      name,
      productType: "com.apple.product-type.app-extension",
      buildConfigurationList: `${id}CONFIGLIST`,
      buildPhases: [],
      buildRules: [],
      dependencies: [],
      fileSystemSynchronizedGroups: ["SHARED"],
    };
    objects[`${id}CONFIGLIST`] = {
      isa: "XCConfigurationList",
      buildConfigurations: [`${id}RELEASE`],
      defaultConfigurationName: "Release",
    };
    objects[`${id}RELEASE`] = {
      isa: "XCBuildConfiguration",
      name: "Release",
      buildSettings: { PRODUCT_BUNDLE_IDENTIFIER: bundle },
    };
  }
  return new XcodeProject("/tmp/conpaws-widget-test.pbxproj", {
    rootObject: "ROOT",
    objects,
  });
}

describe("phone widget target migration", () => {
  it("copies the shared widget privacy manifest without a retired target folder", async () => {
    const projectRoot = mkdtempSync(
      path.join(tmpdir(), "conpaws-widget-config-"),
    );
    const iosRoot = path.join(projectRoot, "ios");
    const projectFolder = path.join(iosRoot, "Fixture.xcodeproj");
    const widgetFolder = path.join(iosRoot, "ExpoWidgetsTarget");
    const sourceFolder = path.join(projectRoot, "src/widgets");
    const manifest = readFileSync(
      new URL("../src/widgets/PrivacyInfo.xcprivacy", import.meta.url),
    );
    try {
      for (const folder of [projectFolder, widgetFolder, sourceFolder]) {
        mkdirSync(folder, { recursive: true });
      }
      writeFileSync(
        path.join(projectFolder, "project.pbxproj"),
        build(projectFixture().toJSON()),
      );
      writeFileSync(path.join(sourceFolder, "PrivacyInfo.xcprivacy"), manifest);
      const config = withConPawsWidgets({
        ios: { bundleIdentifier: "com.mrdemonwolf.conpaws" },
      });
      await config.mods.ios.dangerous({
        ...config,
        modRequest: { projectRoot, platformProjectRoot: iosRoot },
      });
      expect(
        readFileSync(path.join(widgetFolder, "PrivacyInfo.xcprivacy")),
      ).toEqual(manifest);
    } finally {
      rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  it("removes only the matching old phone target and preserves Watch/shared files", () => {
    const project = projectFixture();
    removeLegacyWidgetTarget(project, "com.mrdemonwolf.conpaws");
    expect(
      project.rootObject.props.targets.map((target) => target.uuid),
    ).toEqual(["WATCH", "COMPLICATION", "UNRELATED"]);
    expect(project.has("SHARED")).toBe(true);
    expect(project.has("OLDRELEASE")).toBe(false);
    expect(project.has("WATCHRELEASE")).toBe(true);
    expect(project.has("OLDEXCEPTION")).toBe(false);
    expect(project.has("WATCHEXCEPTION")).toBe(true);
    const migrated = project.toJSON();
    removeLegacyWidgetTarget(project, "com.mrdemonwolf.conpaws");
    expect(project.toJSON()).toEqual(migrated);
  });

  it("retires the existing phone target when prebuilding the other app variant", () => {
    const project = projectFixture();
    removeLegacyWidgetTarget(project, "com.mrdemonwolf.conpaws.dev");
    expect(project.has("OLD")).toBe(false);
    expect(project.has("WATCH")).toBe(true);
    expect(project.has("UNRELATED")).toBe(true);
  });

  it("bundles the extension privacy manifest in its own resources exactly once", () => {
    const fixture = projectFixture().toJSON();
    fixture.objects.OLD.name = "ExpoWidgetsTarget";
    const project = xcode.project("/tmp/conpaws-widget-test.pbxproj");
    project.hash = parser.parse(build(fixture));
    project.hash.project.objects.PBXFileReference = {};
    project.hash.project.objects.PBXBuildFile = {};
    const group = project.addPbxGroup(
      [],
      "ExpoWidgetsTarget",
      "ExpoWidgetsTarget",
    );
    project.addToPbxGroup(group.uuid, "GROUP");
    project.addBuildPhase([], "PBXResourcesBuildPhase", "Resources", "WATCH");
    addWidgetPrivacyManifest(project);
    const resourceIds = () =>
      project.pbxResourcesBuildPhaseObj("OLD").files.map((file) => file.value);
    expect(resourceIds()).toHaveLength(1);
    expect(project.pbxResourcesBuildPhaseObj("WATCH").files).toHaveLength(0);
    const first = resourceIds();
    addWidgetPrivacyManifest(project);
    expect(resourceIds()).toEqual(first);
    expect(project.pbxGroupByName("ExpoWidgetsTarget").children).toHaveLength(
      1,
    );
  });

  it("updates existing extension settings when the app variant or build changes", () => {
    const fixture = projectFixture().toJSON();
    fixture.objects.OLD.name = "ExpoWidgetsTarget";
    const project = xcode.project("/tmp/conpaws-widget-test.pbxproj");
    project.hash = parser.parse(build(fixture));
    syncWidgetBuildSettings(project, {
      ios: {
        bundleIdentifier: "com.mrdemonwolf.conpaws.dev",
        buildNumber: "210",
      },
      version: "1.0.0",
    });
    const settings =
      project.pbxXCBuildConfigurationSection().OLDRELEASE.buildSettings;
    expect(settings.PRODUCT_BUNDLE_IDENTIFIER).toBe(
      '"com.mrdemonwolf.conpaws.dev.widgets"',
    );
    expect(settings.CURRENT_PROJECT_VERSION).toBe('"210"');
    expect(settings.MARKETING_VERSION).toBe('"1.0.0"');
    expect(settings.IPHONEOS_DEPLOYMENT_TARGET).toBe("17.0");
    expect(
      project.pbxXCBuildConfigurationSection().WATCHRELEASE.buildSettings,
    ).toEqual({
      PRODUCT_BUNDLE_IDENTIFIER: "com.mrdemonwolf.conpaws.watchkitapp",
    });
  });
});

describe("generated Android widget integration", () => {
  const provider = `package com.mrdemonwolf.conpaws
import expo.modules.widgets.ExpoWidgetsAppWidgetProvider
class ConPawsWidgetProvider : ExpoWidgetsAppWidgetProvider("ConPawsWidget")`;

  it("routes the generated receiver through the offline boundary and tap bridge", () => {
    const patched = patchAndroidProvider(provider);
    expect(patched).toContain(
      "import expo.modules.conpawswidgets.ConPawsExpoWidgetProvider",
    );
    expect(patched).toContain(
      "class ConPawsWidgetProvider : ConPawsExpoWidgetProvider()",
    );
    expect(patchAndroidProvider(patched)).toBe(patched);
  });

  it("fails closed if an upstream provider template changes", () => {
    expect(() => patchAndroidProvider("class ConPawsWidgetProvider")).toThrow(
      /provider changed/,
    );
  });

  it("keeps a launcher fallback refresh and an accessible minimum resize height", () => {
    const xml =
      '<appwidget-provider android:minHeight="220dp" android:updatePeriodMillis="0" />';
    const patched = patchAndroidWidgetInfo(xml);
    expect(patched).toContain('android:updatePeriodMillis="1800000"');
    expect(patched).toContain('android:minResizeHeight="220dp"');
    expect(patchAndroidWidgetInfo(patched)).toBe(patched);
  });

  it("rebuilds the layout registry after renderer or shared helper edits", () => {
    const patched = patchAndroidBuildGradle("buildscript { }\n");
    expect(patched).toContain(
      "tasks.named('generateExpoWidgetsLayoutRegistry').configure",
    );
    expect(patched).toContain("fileTree(new File(rootDir, '../src/widgets'))");
    expect(patched).toContain("include '**/*'");
    expect(patchAndroidBuildGradle(patched)).toBe(patched);
  });
});
