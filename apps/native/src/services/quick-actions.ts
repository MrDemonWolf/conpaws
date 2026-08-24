import { requireOptionalNativeModule } from "expo";

interface QuickActionsModule {
  consumePendingQuickAction(): string | null;
}

const quickActionsModule =
  requireOptionalNativeModule<QuickActionsModule>("ConPawsWidgets");

export function consumePendingQuickAction(): string | null {
  return quickActionsModule?.consumePendingQuickAction() ?? null;
}
