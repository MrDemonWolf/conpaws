import { Text as RNText, type TextProps as RNTextProps } from 'react-native';
import { cn } from '@/lib/utils';

type TextVariant = 'h1' | 'h2' | 'h3' | 'body' | 'caption' | 'label';

interface TextProps extends RNTextProps {
  variant?: TextVariant;
  className?: string;
}

const variantStyles: Record<TextVariant, string> = {
  h1: 'text-3xl font-bold text-foreground',
  h2: 'text-2xl font-bold text-foreground',
  h3: 'text-xl font-semibold text-foreground',
  body: 'text-base text-foreground',
  caption: 'text-sm text-muted-foreground',
  label: 'text-sm font-medium text-foreground',
};

export function Text({ variant = 'body', className, children, ...props }: TextProps) {
  return (
    <RNText className={cn(variantStyles[variant], className)} {...props}>
      {children}
    </RNText>
  );
}
