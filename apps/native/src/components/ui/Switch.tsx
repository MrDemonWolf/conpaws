import { Switch as RNSwitch, type SwitchProps as RNSwitchProps } from 'react-native';

interface SwitchProps extends RNSwitchProps {
  value: boolean;
  onValueChange: (value: boolean) => void;
}

export function Switch({ value, onValueChange, ...props }: SwitchProps) {
  return (
    <RNSwitch
      value={value}
      onValueChange={onValueChange}
      trackColor={{ false: '#E2E8F0', true: '#0FACED' }}
      thumbColor="#FFFFFF"
      {...props}
    />
  );
}
