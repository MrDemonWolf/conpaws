import { View } from "react-native";
import { Text } from "@/components/ui";
import { cn } from "@/lib/utils";

interface SectionHeaderProps {
  title: string;
  /** A right-aligned count or qualifier: "5 saved", "Not a timed commitment". */
  subtitle?: string;
  className?: string;
}

export function SectionHeader({
  title,
  subtitle,
  className,
}: SectionHeaderProps) {
  return (
    <View
      className={cn(
        "flex-row flex-wrap items-baseline justify-between gap-x-3 gap-y-1 bg-background px-4 pt-5 pb-2",
        className,
      )}
    >
      <Text variant="h3" className="shrink">
        {title}
      </Text>
      {subtitle ? (
        <Text variant="caption" className="tabular-nums">
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}
