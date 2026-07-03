import { StyleSheet, Text, TextInput as NativeTextInput, TextInputProps, View } from 'react-native';
import { colors, radii, spacing, typography } from '../design/tokens';

type AppTextInputProps = TextInputProps & {
  error?: string;
  helperText?: string;
  label: string;
};

export function TextInput({ error, helperText, label, ...inputProps }: AppTextInputProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <NativeTextInput
        keyboardAppearance="dark"
        placeholderTextColor={colors.textSubtle}
        selectionColor={colors.accentText}
        style={[styles.input, error ? styles.inputError : null]}
        {...inputProps}
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
    ...typography.body,
    backgroundColor: colors.panelElevated,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    color: colors.text,
    minHeight: 50,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  inputError: {
    backgroundColor: colors.dangerBackground,
    borderColor: colors.dangerBorder,
  },
  label: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0,
  },
});
