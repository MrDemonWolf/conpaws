const { withInfoPlist } = require("expo/config-plugins");

/**
 * Removes the local-network keys expo-dev-launcher writes into Info.plist.
 *
 * expo-dev-launcher needs `NSLocalNetworkUsageDescription` and the `_expo._tcp`
 * Bonjour service so a development build can discover Metro on the LAN, and its
 * config plugin adds both unconditionally at prebuild, because prebuild has no
 * idea whether the resulting project will be built Debug or Release.
 *
 * It ships a build phase, "[Expo Dev Launcher] Strip Local Network Keys for
 * Release", whose whole job is taking them back out of non-Debug builds. That
 * phase does not work: build 204's Release archive was inspected and both keys
 * survived it, with the phase present in the build log. So a store build
 * declares that it wants local network access, in wording that names
 * development servers, for a capability it does not have -- the release app
 * contains no dev-launcher framework and no EXDevLauncher symbol at all.
 *
 * Nothing can prompt the user, so this is cosmetic. It is worth removing anyway:
 * a purpose string that mentions the developer's computer is the kind of detail
 * App Review asks about, and an unanswerable question is expensive at review
 * time.
 *
 * Only the dev-launcher's own entries are removed. A Bonjour service or usage
 * string that ConPaws adds later is left alone, so this cannot silently break a
 * real local-network feature.
 *
 * Applied only to the preview and production variants -- see app.config.ts.
 * The development variant keeps both keys, because that is the build that
 * actually talks to Metro.
 *
 * Delete this once the upstream strip phase works.
 */

const DEV_LAUNCHER_BONJOUR_SERVICE = "_expo._tcp";
const DEV_LAUNCHER_USAGE_PREFIX = "Expo Dev Launcher uses the local network";

function normalizeService(service) {
  return typeof service === "string"
    ? service.toLowerCase().replace(/\.$/, "")
    : "";
}

module.exports = function withoutDevLauncherLocalNetwork(config) {
  return withInfoPlist(config, (config) => {
    const infoPlist = config.modResults;

    if (Array.isArray(infoPlist.NSBonjourServices)) {
      const remaining = infoPlist.NSBonjourServices.filter(
        (service) => normalizeService(service) !== DEV_LAUNCHER_BONJOUR_SERVICE,
      );
      if (remaining.length > 0) {
        infoPlist.NSBonjourServices = remaining;
      } else {
        delete infoPlist.NSBonjourServices;
      }
    }

    // Matched on the prefix rather than the whole sentence so an upstream
    // reword does not silently turn this into a no-op, and so a description
    // ConPaws sets itself is never touched.
    if (
      typeof infoPlist.NSLocalNetworkUsageDescription === "string" &&
      infoPlist.NSLocalNetworkUsageDescription.startsWith(
        DEV_LAUNCHER_USAGE_PREFIX,
      )
    ) {
      delete infoPlist.NSLocalNetworkUsageDescription;
    }

    return config;
  });
};
