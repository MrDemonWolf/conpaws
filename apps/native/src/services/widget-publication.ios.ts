import ConPawsWidget from "@/widgets/ConPawsWidget";
import type { WidgetSnapshot } from "./widget-snapshot";
import { buildStoredWidgetTimeline } from "./widget-timeline";

export function publishPhoneWidget(snapshot: WidgetSnapshot): void {
  ConPawsWidget.setConfigurationParameterEnum("convention", [
    {
      name: "Automatic",
      value: "current",
    },
    ...snapshot.conventions.map(({ id, name }) => ({ name, value: id })),
  ]);
  ConPawsWidget.updateTimeline(buildStoredWidgetTimeline(snapshot));
}
