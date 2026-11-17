import type { WidgetSnapshot } from "./widget-snapshot";

/** Non-native tooling does not load either platform's native widget runtime. */
export function publishPhoneWidget(_snapshot: WidgetSnapshot): void {}
