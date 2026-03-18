import { View } from 'react-native';
import { Text, Separator } from '@/components/ui';
import { cn } from '@/lib/utils';

interface SectionHeaderProps {
  title: string;
  className?: string;
}

export function SectionHeader({ title, className }: SectionHeaderProps) {
  return (
    <View className={cn('px-4 pt-4 pb-2', className)}>
      <Text variant="label" className="text-muted-foreground uppercase tracking-wide text-xs">
        {title}
      </Text>
      <Separator className="mt-2" />
    </View>
  );
}
