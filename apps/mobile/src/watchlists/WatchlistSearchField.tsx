import { Keyboard, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Search, X } from 'lucide-react-native';
import { colors, radii, spacing, typography } from '../design/tokens';

export function WatchlistSearchField({ value, onChangeText, label, placeholder, accent = false }: {
  value: string; onChangeText: (value: string) => void; label: string; placeholder: string;
  accent?: boolean;
}) {
  const clear = () => { onChangeText(''); Keyboard.dismiss(); };
  return <View style={[styles.field, accent && styles.accentField]}>
    {accent ? <Search size={17} color={colors.textMuted} style={styles.searchIcon} /> : null}
    <TextInput accessibilityLabel={label} value={value} onChangeText={onChangeText} placeholder={placeholder}
      autoCapitalize="none" autoCorrect={false} keyboardAppearance="dark" maxLength={81}
      placeholderTextColor={colors.textSubtle} selectionColor={colors.accentText} style={[styles.input, accent && styles.accentInput]}
      returnKeyType="search" onSubmitEditing={Keyboard.dismiss} />
    {value.length > 0 ? <Pressable accessibilityRole="button" accessibilityLabel="Clear search and dismiss keyboard"
      onPressIn={clear} onPress={clear} style={styles.clear}>
      <X size={18} color={colors.textMuted} />
    </Pressable> : null}
  </View>;
}
const styles = StyleSheet.create({
  field: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, backgroundColor: colors.panelElevated },
  accentField: { borderColor: colors.accentBorder },
  searchIcon: { marginLeft: spacing.sm },
  accentInput: { minHeight: 44, fontSize: 13, paddingHorizontal: spacing.sm },
  input: { flex: 1, minWidth: 0, minHeight: 50, color: colors.text, fontSize: typography.body.fontSize, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  clear: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
});
