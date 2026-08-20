/** @type {import('@bacons/apple-targets/app.plugin').ConfigFunction} */
module.exports = (config) => ({
  type: "widget",
  bundleIdentifier: ".widgets",
  // ponytail: iOS 17 dynamic config avoids a second legacy widget kind.
  deploymentTarget: "17.0",
  entitlements: {
    "com.apple.security.application-groups":
      config.ios.entitlements?.["com.apple.security.application-groups"] ?? [],
  },
});
