import {
  Keyboard,
  StyleSheet,
  Text,
  TextInput as NativeTextInput,
  TextInputProps,
  View,
} from 'react-native';
import { colors, radii, spacing, typography } from '../design/tokens';
import { resolveTextInputAccessibilityLabel } from './textInputAccessibility';

type AppTextInputProps = TextInputProps & {
  error?: string;
  helperText?: string;
  label: string;
};

export function TextInput({
  error,
  helperText,
  label,
  multiline,
  onSubmitEditing,
  returnKeyType,
  ...inputProps
}: AppTextInputProps) {
  const dismissesKeyboardOnSubmit = !multiline && !onSubmitEditing;

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <NativeTextInput
        keyboardAppearance="dark"
        placeholderTextColor={colors.textSubtle}
        selectionColor={colors.accentText}
        style={[
          styles.input,
          multiline ? styles.inputMultiline : null,
          error ? styles.inputError : null,
        ]}
        {...inputProps}
        accessibilityLabel={resolveTextInputAccessibilityLabel(label, inputProps.accessibilityLabel)}
        multiline={multiline}
        onSubmitEditing={onSubmitEditing ?? (dismissesKeyboardOnSubmit ? Keyboard.dismiss : undefined)}
        returnKeyType={returnKeyType ?? (multiline ? undefined : 'done')}
        textAlignVertical={multiline ? 'top' : 'center'}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {!error && helperText ? <Text style={styles.helper}>{helperText}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  error: {
    ...typography.meta,
    color: colors.danger,
    marginTop: spacing.xs,
  },
  field: {
    gap: spacing.xs,
  },
  helper: {
    ...typography.meta,
    color: colors.textSubtle,
    marginTop: spacing.xs,
  },
  input: {
    backgroundColor: colors.panelElevated,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    color: colors.text,
    fontSize: typography.body.fontSize,
    letterSpacing: typography.body.letterSpacing,
    minHeight: 50,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  inputError: {
    backgroundColor: colors.dangerBackground,
    borderColor: colors.dangerBorder,
  },
  inputMultiline: {
    lineHeight: typography.body.lineHeight,
  },
  label: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0,
  },
});
