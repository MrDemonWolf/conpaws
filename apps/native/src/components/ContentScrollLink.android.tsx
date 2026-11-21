import { View } from "react-native";

import type { ContentScrollLinkProps } from "./ContentScrollLink.types";

/**
 * Android has no large titles and its top app bar does not track a scroll
 * view, so the link is a plain container there.
 */
export function ContentScrollLink(props: ContentScrollLinkProps) {
  return <View {...props} />;
}
