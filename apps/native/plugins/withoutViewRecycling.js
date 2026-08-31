const { withMainApplication } = require("expo/config-plugins");

/**
 * Turns off React Native's per-component view recycling on Android.
 *
 * WHAT THIS IS FOR
 *
 * A system dark-mode change that lands while a screen transition is running can
 * kill the app:
 *
 *   FATAL EXCEPTION: main
 *   java.lang.IllegalStateException: The specified child already has a parent.
 *   You must call removeView() on the child's parent first.
 *     at com.facebook.react.fabric.mounting.SurfaceMountingManager.updateLayout
 *     at ...IntBufferBatchMountItem.execute
 *     at ...MountItemDispatcher.tryDispatchMountItems
 *
 * The cause is upstream, in react-native-screens:
 * https://github.com/software-mansion/react-native-screens/issues/3249
 * ("View recycling breaks due to fragment view transitions", open since
 * 2025-09-25, labelled repro-provided, quotes this exact message).
 * `endRemovalTransition` in `Screen.kt` does not correctly end a view
 * transition, so React Native's mounting layer is handed back a recycled native
 * view that still has a parent. Issue #4521 was closed as a duplicate of it.
 *
 * The fix, https://github.com/software-mansion/react-native-screens/pull/3250,
 * is open and unmerged, and its author notes it also needs changes in React
 * Native core. No released version carries it -- not 4.26.2 (what we ship), not
 * the 4.28 nightlies, not the 5.0 alphas. So there is nothing to upgrade to.
 *
 * WHY DISABLING RECYCLING IS THE LEVER
 *
 * The upstream issue is specifically about a view manager handing back a native
 * view instance it has used before. React Native 0.86 ships these defaults:
 *
 *   enableViewRecycling()             false
 *   enableViewRecyclingForImage()     true
 *   enableViewRecyclingForScrollView() false
 *   enableViewRecyclingForText()      true
 *   enableViewRecyclingForView()      true
 *
 * The master switch is off, but View, Text and Image recycle by default, which
 * is what puts us in range of the bug. Turning those three off returns Android
 * to the behaviour React Native had before per-component recycling was enabled
 * by default -- this is a revert to the previous status quo, not a novel
 * configuration. ScrollView is already false upstream and is left alone.
 *
 * WHAT IS NOT KNOWN
 *
 * This mitigation is NOT empirically verified, and that is worth stating plainly
 * rather than discovering later. The crash is rare and load-dependent: it was
 * captured twice, both times while two full native builds were saturating the
 * machine, and it could not be reproduced afterwards across four separate
 * ten-run batches -- idle, with animations stretched 10x, and under synthetic
 * CPU load. With no reproducible failure there is no way to demonstrate a fix;
 * "no crashes afterwards" is exactly what the unmodified build also produces.
 *
 * What it rests on instead: the stack trace matches the upstream issue verbatim,
 * the upstream cause is view recycling, and this disables view recycling.
 *
 * The cost is a performance one and is likewise unmeasured. Recycling exists to
 * avoid reallocating views while scrolling.
 *
 * WHEN TO DELETE THIS
 *
 * When PR #3250 lands in a react-native-screens release we depend on. At that
 * point remove the plugin and this file, and let recycling come back on. If
 * Sentry shows the crash was never happening at a meaningful rate in the first
 * place, that is also a reason to drop it and take the performance back.
 */

const IMPORTS = `import com.facebook.react.internal.featureflags.ReactNativeFeatureFlags
import com.facebook.react.internal.featureflags.ReactNativeFeatureFlagsDefaults`;

const ANCHOR_IMPORT =
  "import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint";

// Must run before the React host is created, which `loadReactNative` does.
const ANCHOR_CALL = "loadReactNative(this)";

const OVERRIDE = `ReactNativeFeatureFlags.override(
      object : ReactNativeFeatureFlagsDefaults() {
        override fun enableViewRecyclingForView(): Boolean = false
        override fun enableViewRecyclingForText(): Boolean = false
        override fun enableViewRecyclingForImage(): Boolean = false
      }
    )
    ${ANCHOR_CALL}`;

module.exports = function withoutViewRecycling(config) {
  return withMainApplication(config, (config) => {
    const { modResults } = config;

    if (modResults.language !== "kt") {
      throw new Error(
        `withoutViewRecycling expects a Kotlin MainApplication, got "${modResults.language}". ` +
          "Expo changed the template; update this plugin rather than skipping it.",
      );
    }

    // Idempotent: prebuild can run against an already-modified file.
    if (modResults.contents.includes("enableViewRecyclingForView")) {
      return config;
    }

    for (const anchor of [ANCHOR_IMPORT, ANCHOR_CALL]) {
      if (!modResults.contents.includes(anchor)) {
        throw new Error(
          `withoutViewRecycling could not find "${anchor}" in MainApplication.kt. ` +
            "Failing loudly rather than silently shipping the crash: check the " +
            "Expo template and re-anchor this plugin.",
        );
      }
    }

    modResults.contents = modResults.contents
      .replace(ANCHOR_IMPORT, `${ANCHOR_IMPORT}\n${IMPORTS}`)
      .replace(ANCHOR_CALL, OVERRIDE);

    return config;
  });
};
