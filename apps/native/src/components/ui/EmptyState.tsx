import { View } from 'react-native';
import { Text } from './Text';
import { Button } from './Button';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
  ctaLabel?: string;
  onCta?: () => void;
  className?: string;
}

export function EmptyState({
  icon,
  title,
  subtitle,
  ctaLabel,
  onCta,
  className,
}: EmptyStateProps) {
  return (
    <View className={cn('flex-1 items-center justify-center px-6 gap-4', className)}>
      {icon ? <View className="mb-2">{icon}</View> : null}
      <View className="items-center gap-2">
        <Text variant="h3" className="text-center">
          {title}
        </Text>
        {subtitle ? (
          <Text variant="caption" className="text-center">
            {subtitle}
          </Text>
        ) : null}
      </View>
      {ctaLabel && onCta ? (
        <Button onPress={onCta} size="md">
          {ctaLabel}
        </Button>
      ) : null}
    </View>
  );
}
