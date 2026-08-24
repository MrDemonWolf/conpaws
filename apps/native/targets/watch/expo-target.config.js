/** @type {import('@bacons/apple-targets/app.plugin').ConfigFunction} */
module.exports = (config) => {
  const icon =
    config.extra?.appVariant === "development"
      ? "icon-development.png"
      : "icon.png";

  return {
    type: "watch",
    name: "ConPawsWatch",
    displayName: "ConPaws",
    bundleIdentifier: ".watchkitapp",
    deploymentTarget: "10.0",
    icon: `../../assets/images/${icon}`,
    colors: { $accent: "#0FACED" },
    entitlements: {
      "com.apple.security.application-groups":
        config.ios.entitlements["com.apple.security.application-groups"],
    },
  };
};
