import { Badge, Row, Text } from "@/components/ui";
import type { CatalogEdition } from "@/lib/catalog/types";

export function CatalogEditionRow({
  edition,
  dateRange,
  scheduleReady,
  scheduleReadyLabel,
  scheduleNotYetLabel,
  onPress,
}: {
  edition: CatalogEdition;
  dateRange: string;
  scheduleReady: boolean;
  scheduleReadyLabel: string;
  scheduleNotYetLabel: string;
  onPress: () => void;
}) {
  return (
    <Row
      className="mx-4 mb-2 rounded-2xl border border-border bg-card px-4 py-3"
      onPress={onPress}
      accessibilityLabel={`${edition.name}, ${dateRange}, ${edition.city}`}
    >
      <Text variant="label">{edition.name}</Text>
      <Text variant="caption" className="pt-1 text-muted-foreground">
        {[dateRange, edition.city].filter(Boolean).join(" · ")}
      </Text>
      <Badge
        variant={scheduleReady ? "info" : "neutral"}
        label={scheduleReady ? scheduleReadyLabel : scheduleNotYetLabel}
        className="mt-2 self-start"
      />
    </Row>
  );
}
