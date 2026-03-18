import { View } from 'react-native';
import { cn } from '@/lib/utils';

interface SeparatorProps {
  className?: string;
}

export function Separator({ className }: SeparatorProps) {
  return <View className={cn('bg-border h-px', className)} />;
}
