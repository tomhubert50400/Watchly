import { useEffect, useState } from 'react';
import { Check } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { discoverMoods, type DiscoverMood } from '../api/discover';
import { BottomActionSheet, BottomActionSheetScrollView } from '../components/BottomActionSheet';
import { Button } from '../components/Button';
import { colors, radii, spacing, typography } from '../design/tokens';
import { hapticSelection } from '../feedback/haptics';

export function DiscoverMoodSheet({ visible, value, onClose, onApply }: {
  visible: boolean; value: DiscoverMood | null; onClose: () => void; onApply: (value: DiscoverMood | null) => void;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => { if (visible) setDraft(value); }, [value, visible]);
  return <BottomActionSheet onClose={onClose} title="What's your mood?" visible={visible} footer={
    <View style={styles.actions}>
      <View style={styles.action}><Button label="Clear mood" variant="secondary" onPress={() => setDraft(null)} /></View>
      <View style={styles.action}><Button label="Apply" onPress={() => onApply(draft)} /></View>
    </View>
  }>
    <BottomActionSheetScrollView>
      <Text style={styles.description}>Choose a mood for your next movie or show.</Text>
      <View style={styles.options}>
        {discoverMoods.map(mood => <Pressable
          accessibilityLabel={`${mood.label}. ${mood.description}`} accessibilityRole="button" accessibilityState={{ selected: draft === mood.id }}
          key={mood.id} onPress={() => { hapticSelection(); setDraft(draft === mood.id ? null : mood.id); }}
          style={[styles.option, draft === mood.id && styles.selected]}
        >
          <View style={styles.optionHeading}><Text style={styles.label}>{mood.label}</Text>{draft === mood.id ? <Check color={colors.accentText} size={16} /> : null}</View>
          <Text style={styles.hint}>{mood.description}</Text>
        </Pressable>)}
      </View>
    </BottomActionSheetScrollView>
  </BottomActionSheet>;
}
const styles = StyleSheet.create({
  description: { ...typography.body, color: colors.muted, marginBottom: spacing.lg },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  option: { flexGrow: 1, flexBasis: '45%', minHeight: 86, padding: spacing.sm, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.panelElevated },
  selected: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  optionHeading: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  label: { fontSize: 14, fontWeight: '700', color: colors.text, flex: 1 },
  hint: { fontSize: 12, lineHeight: 17, color: colors.muted, marginTop: spacing.xs },
  actions: { flexDirection: 'row', gap: spacing.sm }, action: { flex: 1 },
});
