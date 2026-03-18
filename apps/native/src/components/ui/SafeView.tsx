import { SafeAreaView } from 'react-native-safe-area-context';
import { cn } from '@/lib/utils';

interface SafeViewProps {
  children: React.ReactNode;
  edges?: Array<'top' | 'right' | 'bottom' | 'left'>;
  className?: string;
}

export function SafeView({ children, edges = ['top', 'bottom'], className }: SafeViewProps) {
  return (
    <SafeAreaView edges={edges} className={cn('flex-1 bg-background', className)}>
      {children}
    </SafeAreaView>
  );
}
