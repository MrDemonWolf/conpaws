/** @type {import('@bacons/apple-targets/app.plugin').ConfigFunction} */
module.exports = (config) => ({
  type: "watch-widget",
  name: "ConPawsWatchWidgetExtension",
  displayName: "ConPaws",
  bundleIdentifier: ".watchkitapp.widgets",
  deploymentTarget: "10.0",
  colors: {
    $accent: "#0FACED",
    $widgetBackground: "#101419",
  },
  entitlements: {
    "com.apple.security.application-groups":
      config.ios.entitlements["com.apple.security.application-groups"],
  },
});
