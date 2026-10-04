/**
 * Change mode and add verified store URLs together when the app launches.
 * Keep waitlist as the default until both listings are publicly available.
 */
export const LAUNCH: {
  mode: "waitlist" | "live";
  appStoreUrl: string;
  googlePlayUrl: string;
} = {
  mode: "waitlist",
  appStoreUrl: "",
  googlePlayUrl: "",
};

export function validateLaunch(config = LAUNCH) {
  if (config.mode !== "live") return;
  for (const [value, host] of [
    [config.appStoreUrl, "apps.apple.com"],
    [config.googlePlayUrl, "play.google.com"],
  ] as const) {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.hostname !== host) {
      throw new Error("Live mode requires verified HTTPS store listing URLs.");
    }
  }
}

validateLaunch();
