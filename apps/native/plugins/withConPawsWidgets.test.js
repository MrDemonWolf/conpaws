import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  PBXBuildFile,
  PBXCopyFilesBuildPhase,
  XcodeProject,
} from "@bacons/xcode";
import { build } from "@bacons/xcode/json";
import { describe, expect, it } from "vitest";
import xcode from "xcode";
import parser from "xcode/lib/parser/pbxproj";
import withConPawsWidgets, {
  addWidgetResource,
  embedWatchExtensionsInWatchApp,
  patchAndroidBuildGradle,
  patchAndroidProvider,
  patchAndroidWidgetInfo,
  patchWidgetIntentIdentity,
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

const generatedWidgetSwift = `struct ConPawsWidgetConfigurationAppIntent: WidgetConfigurationIntent {
  static var title: LocalizedStringResource = "ConPaws Configuration"
}

enum ConPawsWidgetModeEnum: String, CaseIterable, AppEnum {
  case automatic
}
`;

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
      cpSync(
        new URL("../src/widgets/WidgetAssets.xcassets", import.meta.url),
        path.join(sourceFolder, "WidgetAssets.xcassets"),
        { recursive: true },
      );
      // A stale asset from an earlier prebuild must not survive the copy.
      mkdirSync(path.join(widgetFolder, "WidgetAssets.xcassets/Old.imageset"), {
        recursive: true,
      });
      writeFileSync(
        path.join(widgetFolder, "ConPawsWidget.swift"),
        generatedWidgetSwift,
      );
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
      expect(
        readFileSync(path.join(widgetFolder, "ConPawsWidget.swift"), "utf8"),
      ).toContain('static let persistentIdentifier = "ConPawsWidgetIntent"');
      expect(
        readdirSync(path.join(widgetFolder, "WidgetAssets.xcassets")).sort(),
      ).toEqual(["ConPawsMark.imageset", "Contents.json"]);
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

  it("bundles the extension privacy manifest and assets in its own resources exactly once", () => {
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
    const files = ["PrivacyInfo.xcprivacy", "WidgetAssets.xcassets"];
    for (const file of files) addWidgetResource(project, file);
    const resources = () =>
      project
        .pbxResourcesBuildPhaseObj("OLD")
        .files.map((file) => file.comment)
        .sort();
    expect(resources()).toEqual(files.map((file) => `${file} in Resources`));
    expect(project.pbxResourcesBuildPhaseObj("WATCH").files).toHaveLength(0);
    const first = resources();
    for (const file of files) addWidgetResource(project, file);
    expect(resources()).toEqual(first);
    expect(project.pbxGroupByName("ExpoWidgetsTarget").children).toHaveLength(
      2,
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
    expect(settings.INFOPLIST_KEY_CFBundleDisplayName).toBe('"ConPaws"');
    expect(
      project.pbxXCBuildConfigurationSection().WATCHRELEASE.buildSettings,
    ).toEqual({
      PRODUCT_BUNDLE_IDENTIFIER: "com.mrdemonwolf.conpaws.watchkitapp",
    });
  });
});

// The four Apple targets as a fresh prebuild leaves them (`fresh`), or as a
// long-lived project has them. apple-targets creates the watch widget before
// the Watch app on a fresh prebuild and embeds it in the iPhone app.
function watchEmbedFixture({ fresh = true, watchApp = true } = {}) {
  const objects = {
    ROOT: {
      isa: "PBXProject",
      targets: [],
      mainGroup: "GROUP",
      buildConfigurationList: "PROJECTCONFIG",
    },
    GROUP: { isa: "PBXGroup", children: [], sourceTree: "<group>" },
    PROJECTCONFIG: {
      isa: "XCConfigurationList",
      buildConfigurations: [],
      defaultConfigurationName: "Release",
    },
  };
  const phone = { SDKROOT: "iphoneos", IPHONEOS_DEPLOYMENT_TARGET: "16.4" };
  const watch = { SDKROOT: "watchos", WATCHOS_DEPLOYMENT_TARGET: "10.0" };
  for (const [id, name, productType, product, settings] of [
    ["PHONE", "ConPaws", "application", "ConPaws.app", phone],
    ["PHONEWIDGET", "ExpoWidgetsTarget", "app-extension", ".appex", phone],
    [
      "WATCHWIDGET",
      "ConPawsWatchWidgetExtension",
      "app-extension",
      ".appex",
      watch,
    ],
    ...(watchApp
      ? [["WATCH", "ConPawsWatch", "application", "ConPawsWatch.app", watch]]
      : []),
  ]) {
    objects.ROOT.targets.push(id);
    objects[id] = {
      isa: "PBXNativeTarget",
      name,
      productName: name,
      productType: `com.apple.product-type.${productType}`,
      productReference: `${id}PRODUCT`,
      buildConfigurationList: `${id}CONFIGLIST`,
      buildPhases: [],
      buildRules: [],
      dependencies: [],
    };
    objects[`${id}PRODUCT`] = {
      isa: "PBXFileReference",
      explicitFileType: `wrapper.${productType}`,
      includeInIndex: 0,
      path: product.startsWith(".") ? `${name}${product}` : product,
      sourceTree: "BUILT_PRODUCTS_DIR",
    };
    objects[`${id}CONFIGLIST`] = {
      isa: "XCConfigurationList",
      buildConfigurations: [`${id}RELEASE`],
      defaultConfigurationName: "Release",
    };
    objects[`${id}RELEASE`] = {
      isa: "XCBuildConfiguration",
      name: "Release",
      buildSettings: { ...settings },
    };
  }
  const project = new XcodeProject("/tmp/conpaws-watch-embed.pbxproj", {
    rootObject: "ROOT",
    objects,
  });
  const target = (id) => project.getObject(id);
  const embed = (host, name, dstSubfolderSpec, dstPath, ids) =>
    host.createBuildPhase(PBXCopyFilesBuildPhase, {
      name,
      dstSubfolderSpec,
      dstPath,
      files: ids.map((id) =>
        PBXBuildFile.create(project, {
          fileRef: target(id).props.productReference,
          settings: { ATTRIBUTES: ["RemoveHeadersOnCopy"] },
        }),
      ),
    });
  const phoneApp = target("PHONE");
  const extensions = fresh ? ["PHONEWIDGET", "WATCHWIDGET"] : ["PHONEWIDGET"];
  embed(phoneApp, "Embed Foundation Extensions", 13, "", extensions);
  for (const id of extensions) phoneApp.addDependency(target(id));
  if (watchApp) {
    embed(
      phoneApp,
      "Embed Watch Content",
      16,
      "$(CONTENTS_FOLDER_PATH)/Watch",
      ["WATCH"],
    );
    phoneApp.addDependency(target("WATCH"));
    if (!fresh) {
      embed(target("WATCH"), "Embed Foundation Extensions", 13, "", [
        "WATCHWIDGET",
      ]);
      target("WATCH").addDependency(target("WATCHWIDGET"));
    }
  }
  return project;
}

function embedState(project) {
  return Object.fromEntries(
    project.rootObject.props.targets.map((target) => [
      target.props.name,
      {
        embeds: target.props.buildPhases
          .filter((phase) => PBXCopyFilesBuildPhase.is(phase))
          .map((phase) => [
            phase.props.name,
            phase.props.dstSubfolderSpec,
            phase.props.files.map((file) => file.props.fileRef.props.path),
          ]),
        dependencies: target.props.dependencies
          .map((dependency) => dependency.props.target.props.name)
          .sort(),
      },
    ]),
  );
}

const countObjects = (project, isa) =>
  [...project.values()].filter((object) => object.isa === isa).length;

const embeddedInWatchApp = {
  ConPaws: {
    embeds: [
      ["Embed Foundation Extensions", 13, ["ExpoWidgetsTarget.appex"]],
      ["Embed Watch Content", 16, ["ConPawsWatch.app"]],
    ],
    dependencies: ["ConPawsWatch", "ExpoWidgetsTarget"],
  },
  ExpoWidgetsTarget: { embeds: [], dependencies: [] },
  ConPawsWatchWidgetExtension: { embeds: [], dependencies: [] },
  ConPawsWatch: {
    embeds: [
      [
        "Embed Foundation Extensions",
        13,
        ["ConPawsWatchWidgetExtension.appex"],
      ],
    ],
    dependencies: ["ConPawsWatchWidgetExtension"],
  },
};

describe("Watch widget embedding", () => {
  it("moves a watch widget a fresh prebuild left in the iPhone app into the Watch app", () => {
    const project = watchEmbedFixture();
    expect(embedState(project).ConPaws.embeds[0][2]).toContain(
      "ConPawsWatchWidgetExtension.appex",
    );
    embedWatchExtensionsInWatchApp(project);
    expect(embedState(project)).toEqual(embeddedInWatchApp);
    // Moved, not copied: no orphaned build file, dependency or proxy remains.
    expect(countObjects(project, "PBXBuildFile")).toBe(3);
    expect(countObjects(project, "PBXTargetDependency")).toBe(3);
    expect(countObjects(project, "PBXContainerItemProxy")).toBe(3);
    const repaired = build(project.toJSON());
    embedWatchExtensionsInWatchApp(project);
    expect(build(project.toJSON())).toBe(repaired);
  });

  it("leaves an incrementally prebuilt project unchanged", () => {
    const project = watchEmbedFixture({ fresh: false });
    const before = build(project.toJSON());
    embedWatchExtensionsInWatchApp(project);
    expect(build(project.toJSON())).toBe(before);
    expect(embedState(project)).toEqual(embeddedInWatchApp);
  });

  it("fails closed when no Watch app can host the watch widget", () => {
    const project = watchEmbedFixture({ watchApp: false });
    expect(() => embedWatchExtensionsInWatchApp(project)).toThrow(
      /Expected one Watch app to embed ConPawsWatchWidgetExtension; found 0/,
    );
  });

  it("repairs the written project after every generator has run", async () => {
    const projectRoot = mkdtempSync(path.join(tmpdir(), "conpaws-watch-"));
    const projectPath = path.join(
      projectRoot,
      "ios/Fixture.xcodeproj/project.pbxproj",
    );
    try {
      mkdirSync(path.dirname(projectPath), { recursive: true });
      writeFileSync(projectPath, build(watchEmbedFixture().toJSON()));
      const config = withConPawsWidgets({
        ios: { bundleIdentifier: "com.mrdemonwolf.conpaws" },
      });
      await config.mods.ios.finalized({
        ...config,
        modRequest: {
          projectRoot,
          platformProjectRoot: path.join(projectRoot, "ios"),
        },
      });
      expect(embedState(XcodeProject.open(projectPath))).toEqual(
        embeddedInWatchApp,
      );
    } finally {
      rmSync(projectRoot, { recursive: true, force: true });
    }
  });
});

describe("pinned widget identity", () => {
  it("keeps the retired Swift widget's intent and display identities", () => {
    const patched = patchWidgetIntentIdentity(generatedWidgetSwift);
    expect(patched).toContain(
      `struct ConPawsWidgetConfigurationAppIntent: WidgetConfigurationIntent {
  static let persistentIdentifier = "ConPawsWidgetIntent"`,
    );
    expect(patched).toContain(
      `enum ConPawsWidgetModeEnum: String, CaseIterable, AppEnum {
  static let persistentIdentifier = "ConPawsWidgetMode"`,
    );
    expect(patchWidgetIntentIdentity(patched)).toBe(patched);
  });

  it("fails closed if the generated intent source changes", () => {
    expect(() =>
      patchWidgetIntentIdentity(
        "struct OtherIntent: WidgetConfigurationIntent {",
      ),
    ).toThrow(/intent source changed/);
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
