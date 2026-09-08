import { ChevronLeft } from 'lucide-react-native';
import { Pressable, StyleSheet, Text } from 'react-native';
import { colors } from '../design/tokens';

export function StackBackButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityLabel={`Back to ${label}`}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
    >
      <ChevronLeft color={colors.text} size={24} />
      <Text numberOfLines={1} style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    flexDirection: 'row',
    minHeight: 44,
    minWidth: 44,
    maxWidth: 180,
  },
  label: { color: colors.text, flexShrink: 1, fontSize: 17 },
  pressed: { opacity: 0.58 },
});
