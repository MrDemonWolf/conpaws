import * as WebBrowser from "expo-web-browser";
import { Alert, Linking } from "react-native";

import { reportError } from "@/lib/error-reporting";

/**
 * Opens a link that leaves the app, and admits it when that fails.
 *
 * Every call site used to be a bare `WebBrowser.openBrowserAsync(url)` inside
 * an `onPress`, which floats the promise. Two of those reject in ordinary use:
 * `openBrowserAsync` rejects when a browser is already presented, which a
 * double tap produces, and `Linking.openURL` on a `mailto:` rejects outright on
 * any device with no mail account -- the simulator, and plenty of real Android
 * phones. Both were unhandled rejections that told the reader nothing.
 *
 * The scheme picks the mechanism, so callers do not repeat that branch: a
 * `mailto:` or `tel:` has to be handed to the OS, while http(s) belongs in the
 * in-app browser where the reader keeps their place in ConPaws.
 *
 * `message` is the already-translated line to show if it fails; the caller owns
 * translation because this module has no access to a hook.
 */
export async function openExternal(
  url: string,
  strings: { errorTitle: string; errorMessage: string },
): Promise<boolean> {
  const handedToOs = !/^https?:/i.test(url);

  try {
    if (handedToOs) {
      await Linking.openURL(url);
    } else {
      await WebBrowser.openBrowserAsync(url);
    }
    return true;
  } catch (error) {
    // The scheme is the useful detail and is low cardinality; the URL itself
    // is not interpolated into the scope tag.
    reportError(error, {
      scope: "open-external",
      tags: { scheme: url.split(":")[0] ?? "unknown" },
    });
    Alert.alert(strings.errorTitle, strings.errorMessage);
    return false;
  }
}
