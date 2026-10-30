import { Button, Card, Text } from "@/components/ui";

export function CatalogFallbackCard({
  title,
  body,
  importLabel,
  createLabel,
  onImport,
  onCreate,
}: {
  title: string;
  body: string;
  importLabel: string;
  createLabel: string;
  onImport: () => void;
  onCreate: () => void;
}) {
  return (
    <Card className="mx-4 mt-4 gap-2">
      <Text variant="label">{title}</Text>
      <Text variant="caption" className="text-muted-foreground">
        {body}
      </Text>
      <Button onPress={onImport} variant="outline" className="mt-1 w-full">
        {importLabel}
      </Button>
      <Button onPress={onCreate} variant="ghost" className="w-full">
        {createLabel}
      </Button>
    </Card>
  );
}
