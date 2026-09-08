import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { browseGenreLabel, browseGenres, discoverMoods, type BrowseFilters } from '../api/discover';
import { BottomActionSheet, BottomActionSheetScrollView } from '../components/BottomActionSheet';
import { Button } from '../components/Button';
import { colors, radii, spacing, typography } from '../design/tokens';

export function DiscoverFiltersSheet({ visible, value, onClose, onApply }: {
  visible: boolean; value: BrowseFilters; onClose: () => void; onApply: (value: BrowseFilters) => void;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => { if (visible) setDraft(value); }, [visible, value]);
  const option = (label: string, selected: boolean, onPress: () => void) => <Pressable key={label} accessibilityRole="button" accessibilityState={{ selected }} onPress={onPress} style={[styles.option, selected && styles.selected]}><Text style={styles.label}>{label}</Text></Pressable>;
  return <BottomActionSheet visible={visible} title="Explore your way" onClose={onClose} footer={<View style={styles.actions}><View style={styles.action}><Button label="Clear filters" variant="secondary" onPress={() => setDraft({})} /></View><View style={styles.action}><Button label="Apply filters" onPress={() => onApply(draft)} /></View></View>}>
    <BottomActionSheetScrollView>
      <Text style={styles.heading}>Mood</Text>
      <Text style={styles.hint}>A starting point inspired by genres. Every story feels different.</Text>
      <View style={styles.options}>{discoverMoods.map(mood => option(mood.label, draft.mood === mood.id, () => setDraft({ ...draft, mood: draft.mood === mood.id ? undefined : mood.id })))}</View>
      <Text style={styles.heading}>Genre</Text>
      <View style={styles.options}>{browseGenres.map(genre => option(browseGenreLabel(genre), draft.genre === genre, () => setDraft({ ...draft, genre: draft.genre === genre ? undefined : genre })))}</View>
      <Text style={styles.heading}>Era</Text>
      <View style={styles.options}>{[1980, 1990, 2000, 2010, 2020].map(decade => option(`${decade}s`, draft.decade === decade, () => setDraft({ ...draft, decade: draft.decade === decade ? undefined : decade })))}</View>
      <Text style={styles.heading}>Selection</Text>
      <View style={styles.options}>{option('Award winners', Boolean(draft.awards), () => setDraft({ ...draft, awards: !draft.awards }))}</View>
    </BottomActionSheetScrollView>
  </BottomActionSheet>;
}
const styles = StyleSheet.create({
  heading: { ...typography.title, color: colors.text, marginTop: spacing.md, marginBottom: spacing.sm }, hint: { ...typography.meta, color: colors.muted, marginBottom: spacing.sm },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }, option: { minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.md, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.panelElevated },
  selected: { borderColor: colors.accent, backgroundColor: colors.accentSoft }, label: { color: colors.text, fontSize: 14, fontWeight: '600' }, actions: { flexDirection: 'row', gap: spacing.sm }, action: { flex: 1 },
});
