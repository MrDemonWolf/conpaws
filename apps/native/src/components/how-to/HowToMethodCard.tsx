import { useTranslation } from "react-i18next";
import { Button, Card, Text } from "@/components/ui";
import { HOW_TO_GUIDES, type HowToMethod } from "@/lib/how-to";
import { HowToPicture } from "./pictures";

/**
 * One way to get a schedule in, on Settings > Getting started: a picture, the
 * method's name and one sentence, and the button that opens its walkthrough.
 */
export function HowToMethodCard({
  method,
  onShowMe,
}: {
  method: HowToMethod;
  onShowMe: () => void;
}) {
  const { t } = useTranslation();
  const guide = HOW_TO_GUIDES[method];

  return (
    <Card className="gap-3">
      <HowToPicture id={guide.hero} surface="card" />
      <Text variant="h3">{t(guide.title)}</Text>
      <Text variant="body" className="text-muted-foreground">
        {t(guide.summary)}
      </Text>
      {/* Outline, not secondary: on iOS `bg-secondary` is the card's own
          colour, so a secondary button would lose its shape here. */}
      <Button
        variant="outline"
        className="w-full"
        onPress={onShowMe}
        accessibilityLabel={`${t("howTo.showMe")}, ${t(guide.title)}`}
        accessibilityHint={t("howTo.showMeHint")}
        testID={`getting-started-show-${method}`}
      >
        {t("howTo.showMe")}
      </Button>
    </Card>
  );
}
