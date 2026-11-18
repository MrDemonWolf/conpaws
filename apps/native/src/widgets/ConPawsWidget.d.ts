import type { Widget, WidgetEnvironment } from "expo-widgets";
import type { ReactElement } from "react";
import type {
  ConPawsWidgetConfiguration,
  ConPawsWidgetProps,
} from "./ConPawsWidget.types";

export function ConPawsWidgetLayout(
  props: ConPawsWidgetProps,
  environment: WidgetEnvironment<ConPawsWidgetConfiguration>,
): ReactElement;

declare const ConPawsWidget: Widget<
  ConPawsWidgetProps,
  ConPawsWidgetConfiguration
>;
export default ConPawsWidget;
