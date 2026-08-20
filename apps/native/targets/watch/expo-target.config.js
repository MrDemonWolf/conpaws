/** @type {import('@bacons/apple-targets/app.plugin').ConfigFunction} */
module.exports = (config) => ({
  type: "watch",
  name: "ConPawsWatch",
  displayName: "ConPaws",
  bundleIdentifier: ".watchkitapp",
  deploymentTarget: "10.0",
  icon: "../../assets/images/icon.png",
  colors: { $accent: "#0FACED" },
  entitlements: {
    "com.apple.security.application-groups":
      config.ios.entitlements["com.apple.security.application-groups"],
  },
});
