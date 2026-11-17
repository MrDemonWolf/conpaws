import ConPawsWidget from "@/widgets/ConPawsWidget";
import type { WidgetSnapshot } from "./widget-snapshot";

export function publishPhoneWidget(snapshot: WidgetSnapshot): void {
  ConPawsWidget.updateSnapshot({ snapshot });
}
