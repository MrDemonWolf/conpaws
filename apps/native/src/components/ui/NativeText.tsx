import { Text as ExpoText } from "@expo/ui";

import type { NativeTextProps } from "./NativeText.types";

/**
 * Default fallback. The two platforms this app ships take
 * `NativeText.android.tsx` and `NativeText.ios.tsx`; this file exists so the
 * import resolves for TypeScript and any other target, and so neither real
 * implementation has to double as the default.
 *
 * Pass-through, because the Android colour is a workaround for a Compose
 * behaviour no other platform necessarily shares -- see the Android file.
 */
export function NativeText({ tone: _tone, ...props }: NativeTextProps) {
  return <ExpoText {...props} />;
}
