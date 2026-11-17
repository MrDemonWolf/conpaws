const fs = require("node:fs");
const path = require("node:path");
const { XcodeProject } = require("@bacons/xcode");
const { build } = require("@bacons/xcode/json");
const {
  AndroidConfig,
  IOSConfig,
  withAndroidManifest,
  withDangerousMod,
  withProjectBuildGradle,
  withXcodeProject,
} = require("expo/config-plugins");

function removeLegacyWidgetTarget(project, bundleIdentifier) {
  const baseBundleIdentifier = bundleIdentifier.replace(/\.dev$/, "");
  const legacyIdentifiers = new Set([
    `${baseBundleIdentifier}.widgets`,
    `${baseBundleIdentifier}.dev.widgets`,
  ]);
  for (const target of [...project.rootObject.props.targets]) {
    if (
      target.props.name === "widget" &&
      legacyIdentifiers.has(
        target.getDefaultBuildSetting("PRODUCT_BUNDLE_IDENTIFIER"),
      )
    ) {
      // Shared Swift groups keep per-target membership exceptions. Remove the
      // retired target's exceptions before removing its model references.
      for (const object of [...project.values()]) {
        if (
          object.isa === "PBXFileSystemSynchronizedBuildFileExceptionSet" &&
          object.props.target?.uuid === target.uuid
        ) {
          object.removeFromProject();
        }
      }
      target.removeFromProject();
    }
  }
}

function patchAndroidProvider(source) {
  const generated = 'ExpoWidgetsAppWidgetProvider("ConPawsWidget")';
  const replacement = "ConPawsExpoWidgetProvider()";
  if (source.includes(replacement)) return source;
  if (!source.includes(generated))
    throw new Error(
      "expo-widgets provider changed; review the ConPaws boundary bridge.",
    );
  return source
    .replace(
      "import expo.modules.widgets.ExpoWidgetsAppWidgetProvider",
      "import expo.modules.conpawswidgets.ConPawsExpoWidgetProvider",
    )
    .replace(generated, replacement);
}

function patchAndroidWidgetInfo(source) {
  return source
    .replace(
      'android:updatePeriodMillis="0"',
      'android:updatePeriodMillis="1800000"',
    )
    .replace(/\s+android:minResizeHeight="[^"]*"/g, "")
    .replace(
      "<appwidget-provider ",
      '<appwidget-provider android:minResizeHeight="220dp" ',
    );
}

function patchAndroidBuildGradle(source) {
  const marker = "// ConPaws Expo Widgets layout source inputs";
  if (source.includes(marker)) return source;
  return `${source.trimEnd()}\n\n${marker}
gradle.projectsEvaluated {
    project(':expo-widgets').tasks.named('generateExpoWidgetsLayoutRegistry').configure {
        inputs.files(fileTree(new File(rootDir, '../src/widgets')) {
            include '**/*'
        })
    }
}
`;
}

function addWidgetPrivacyManifest(project) {
  const targetUuid = project.findTargetKey("ExpoWidgetsTarget");
  if (!targetUuid) throw new Error("ExpoWidgetsTarget was not generated.");
  const target = project.pbxNativeTargetSection()[targetUuid];
  let phases = project.hash.project.objects.PBXResourcesBuildPhase ?? {};
  if (!target.buildPhases.some((phase) => phases[phase.value])) {
    project.addBuildPhase(
      [],
      "PBXResourcesBuildPhase",
      "Resources",
      targetUuid,
    );
  }
  IOSConfig.XcodeUtils.addResourceFileToGroup({
    project,
    filepath: "PrivacyInfo.xcprivacy",
    groupName: "ExpoWidgetsTarget",
    isBuildFile: true,
    targetUuid,
  });
  const fileRef = project
    .pbxGroupByName("ExpoWidgetsTarget")
    .children.find((child) => child.comment === "PrivacyInfo.xcprivacy").value;
  const buildFiles = project.pbxBuildFileSection();
  const buildFileId = Object.keys(buildFiles).find(
    (key) => buildFiles[key]?.fileRef === fileRef,
  );
  // Repair a prior attachment through Expo's fallback to the app's resources
  // phase. Keep the main app's separate privacy manifest intact.
  phases = project.hash.project.objects.PBXResourcesBuildPhase;
  for (const [key, phase] of Object.entries(phases)) {
    if (key.endsWith("_comment")) continue;
    phase.files = phase.files.filter(
      (file) => buildFiles[file.value]?.fileRef !== fileRef,
    );
  }
  const resources = target.buildPhases.find((phase) => phases[phase.value]);
  phases[resources.value].files.push({
    value: buildFileId,
    comment: "PrivacyInfo.xcprivacy in Resources",
  });
}

function syncWidgetBuildSettings(project, config) {
  const target = project.pbxTargetByName("ExpoWidgetsTarget");
  for (const [
    ,
    configuration,
  ] of IOSConfig.XcodeUtils.getBuildConfigurationsForListId(
    project,
    target.buildConfigurationList,
  )) {
    Object.assign(configuration.buildSettings, {
      PRODUCT_BUNDLE_IDENTIFIER: `"${config.ios.bundleIdentifier}.widgets"`,
      CURRENT_PROJECT_VERSION: `"${config.ios.buildNumber}"`,
      MARKETING_VERSION: `"${config.ios.version ?? config.version}"`,
      // Match the existing widget's AppIntent minimum; Expo defaults to 16.4.
      IPHONEOS_DEPLOYMENT_TARGET: "17.0",
    });
  }
}

// Registered before expo-widgets: Expo mods run in reverse registration order.
module.exports = function withConPawsWidgets(config) {
  config = withDangerousMod(config, [
    "ios",
    async (config) => {
      const projectPath = IOSConfig.Paths.getPBXProjectPath(
        config.modRequest.projectRoot,
      );
      const project = XcodeProject.open(projectPath);
      removeLegacyWidgetTarget(project, config.ios.bundleIdentifier);
      fs.writeFileSync(projectPath, build(project.toJSON()));
      fs.copyFileSync(
        path.join(
          config.modRequest.projectRoot,
          "src/widgets/PrivacyInfo.xcprivacy",
        ),
        path.join(
          config.modRequest.platformProjectRoot,
          "ExpoWidgetsTarget/PrivacyInfo.xcprivacy",
        ),
      );
      return config;
    },
  ]);
  config = withXcodeProject(config, (config) => {
    addWidgetPrivacyManifest(config.modResults);
    // expo-widgets keeps an existing target's build settings on incremental
    // prebuilds. Keep variant identity and reserved store numbers in sync.
    syncWidgetBuildSettings(config.modResults, config);
    return config;
  });
  config = withDangerousMod(config, [
    "android",
    async (config) => {
      const packageName = config.android.package;
      const androidRoot = config.modRequest.platformProjectRoot;
      const provider = path.join(
        androidRoot,
        "app/src/main/java",
        ...packageName.split("."),
        "ConPawsWidgetProvider.kt",
      );
      fs.writeFileSync(
        provider,
        patchAndroidProvider(fs.readFileSync(provider, "utf8")),
      );
      const widgetInfo = path.join(
        androidRoot,
        "app/src/main/res/xml/con_paws_widget_info.xml",
      );
      fs.writeFileSync(
        widgetInfo,
        patchAndroidWidgetInfo(fs.readFileSync(widgetInfo, "utf8")),
      );
      return config;
    },
  ]);
  config = withProjectBuildGradle(config, (config) => {
    if (config.modResults.language !== "groovy") {
      throw new Error(
        "Review the ConPaws widget source inputs for Kotlin Gradle.",
      );
    }
    config.modResults.contents = patchAndroidBuildGradle(
      config.modResults.contents,
    );
    return config;
  });
  return withAndroidManifest(config, (config) => {
    const application = AndroidConfig.Manifest.getMainApplicationOrThrow(
      config.modResults,
    );
    const receiver = application.receiver?.find(
      (entry) => entry.$["android:name"] === ".ConPawsWidgetProvider",
    );
    if (!receiver) throw new Error("ConPawsWidgetProvider was not generated.");
    receiver.$["android:exported"] = "false";
    return config;
  });
};

module.exports.removeLegacyWidgetTarget = removeLegacyWidgetTarget;
module.exports.patchAndroidProvider = patchAndroidProvider;
module.exports.patchAndroidWidgetInfo = patchAndroidWidgetInfo;
module.exports.patchAndroidBuildGradle = patchAndroidBuildGradle;
module.exports.addWidgetPrivacyManifest = addWidgetPrivacyManifest;
module.exports.syncWidgetBuildSettings = syncWidgetBuildSettings;
