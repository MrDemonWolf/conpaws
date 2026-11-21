import { requireNativeView } from "expo";
import type { ComponentType } from "react";

import type { ContentScrollLinkProps } from "./ContentScrollLink.types";

const NativeContentScrollLink = requireNativeView<ContentScrollLinkProps>(
  "ConPawsContentScrollLink",
) as ComponentType<ContentScrollLinkProps>;

/**
 * Hands UIKit the scroll view inside an `@expo/ui` `Host`, which UIKit cannot
 * find by itself, so a large title collapses over a SwiftUI `Form` or `List`.
 */
export function ContentScrollLink(props: ContentScrollLinkProps) {
  return <NativeContentScrollLink {...props} />;
}
