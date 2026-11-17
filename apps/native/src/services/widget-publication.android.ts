import ConPawsWidget from "@/widgets/ConPawsWidget";
import type { WidgetSnapshot } from "./widget-snapshot";
import { buildStoredWidgetProps } from "./widget-timeline";

export function publishPhoneWidget(snapshot: WidgetSnapshot): void {
  ConPawsWidget.updateSnapshot(buildStoredWidgetProps(snapshot));
}
