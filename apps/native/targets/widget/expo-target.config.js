/** @type {import('@bacons/apple-targets/app.plugin').ConfigFunction} */
module.exports = (config) => ({
  type: "widget",
  bundleIdentifier: ".widgets",
  // ponytail: iOS 17 dynamic config avoids a second legacy widget kind.
  deploymentTarget: "17.0",
  colors: {
    // Widget brand accent per docs/widget-redesign-2026-08.html §1. The light
    // value #00729C measures ≈4.7:1 on white — a documented divergence from
    // the app's AAA policy, allowed at headline sizes only. Brand-colored text
    // below ~13pt in light mode must use BrandSmallText instead. Dark mode's
    // #18B7F2 clears 8:1 on its own and needs no small-text variant.
    BrandPrimary: { light: "#00729C", dark: "#18B7F2" },
    BrandSmallText: { light: "#00618A", dark: "#18B7F2" },
  },
  entitlements: {
    "com.apple.security.application-groups":
      config.ios.entitlements?.["com.apple.security.application-groups"] ?? [],
  },
});
