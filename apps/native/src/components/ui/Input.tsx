import { View, TextInput, type TextInputProps } from 'react-native';
import { Text } from './Text';
import { cn } from '@/lib/utils';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  className?: string;
}

export function Input({ label, error, className, ...props }: InputProps) {
  return (
    <View className="gap-1.5">
      {label ? (
        <Text variant="label" className="text-foreground">
          {label}
        </Text>
      ) : null}
      <TextInput
        className={cn(
          'border rounded-xl px-3 py-2.5 text-foreground bg-background',
          error ? 'border-destructive' : 'border-input',
          className,
        )}
        placeholderTextColor="#94A3B8"
        {...props}
      />
      {error ? (
        <Text variant="caption" className="text-destructive">
          {error}
        </Text>
      ) : null}
    </View>
  );
}
