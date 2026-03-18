import { Pressable, ActivityIndicator } from 'react-native';
import { Text } from './Text';
import { cn } from '@/lib/utils';

type ButtonVariant = 'default' | 'secondary' | 'outline' | 'ghost' | 'destructive';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps {
  onPress?: () => void;
  children: React.ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  className?: string;
}

const variantStyles: Record<ButtonVariant, string> = {
  default: 'bg-primary',
  secondary: 'bg-secondary',
  outline: 'border border-border bg-transparent',
  ghost: 'bg-transparent',
  destructive: 'bg-destructive',
};

const textVariantStyles: Record<ButtonVariant, string> = {
  default: 'text-primary-foreground',
  secondary: 'text-secondary-foreground',
  outline: 'text-foreground',
  ghost: 'text-foreground',
  destructive: 'text-destructive-foreground',
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 rounded-lg',
  md: 'px-4 py-2.5 rounded-xl',
  lg: 'px-6 py-3.5 rounded-xl',
};

const textSizeStyles: Record<ButtonSize, string> = {
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-lg',
};

export function Button({
  onPress,
  children,
  variant = 'default',
  size = 'md',
  disabled = false,
  loading = false,
  className,
}: ButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      className={cn(
        'flex-row items-center justify-center',
        variantStyles[variant],
        sizeStyles[size],
        (disabled || loading) && 'opacity-50',
        className,
      )}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'default' || variant === 'destructive' ? '#FFFFFF' : '#0FACED'}
        />
      ) : typeof children === 'string' ? (
        <Text
          className={cn('font-semibold', textVariantStyles[variant], textSizeStyles[size])}
        >
          {children}
        </Text>
      ) : (
        children
      )}
    </Pressable>
  );
}
