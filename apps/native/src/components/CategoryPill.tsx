import { Pressable } from 'react-native';
import { Text } from '@/components/ui';
import { cn } from '@/lib/utils';

interface CategoryPillProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  className?: string;
}

export function CategoryPill({ label, selected = false, onPress, className }: CategoryPillProps) {
  return (
    <Pressable
      onPress={onPress}
      className={cn(
        'px-3 py-1 rounded-full border',
        selected ? 'bg-primary border-primary' : 'bg-transparent border-border',
        className,
      )}
    >
      <Text
        variant="caption"
        className={cn('font-medium', selected ? 'text-primary-foreground' : 'text-muted-foreground')}
      >
        {label}
      </Text>
    </Pressable>
  );
}
