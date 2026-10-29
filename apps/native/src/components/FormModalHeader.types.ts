export interface FormModalHeaderProps {
  title: string;
  cancelLabel: string;
  onCancel: () => void;
  /** Omit for a header with no confirm action, e.g. import. */
  confirmLabel?: string;
  onConfirm?: () => void;
  confirmDisabled?: boolean;
}
