import { useState } from 'react';
import { Check, ChevronDown } from 'lucide-react-native';
import { Alert, Pressable, StyleSheet, Text, TextInput } from 'react-native';
import { BottomActionSheet, BottomActionSheetScrollView } from '../components/BottomActionSheet';
import { colors, radii, spacing, typography } from '../design/tokens';
import { watchRegions } from './watchRegionModel';
import { useWatchRegion } from './useWatchRegion';

export function WatchRegionPicker({ region }: { region: ReturnType<typeof useWatchRegion> }) {
  const [visible, setVisible] = useState(false);
  const [query, setQuery] = useState('');
  const selected = watchRegions.find((item) => item.code === region.country);
  const search = query.trim().toLowerCase();
  const matches = watchRegions.filter((item) => `${item.name} ${item.code}`.toLowerCase().includes(search));

  async function select(country: string | null) {
    setVisible(false);
    try {
      await region.setCountry(country);
    } catch {
      Alert.alert('Region not saved', 'Your selection applies now, but could not be saved for next time.');
    }
  }

  return (
    <>
      <Pressable
        accessibilityLabel={`Watch region: ${selected?.name ?? 'not selected'}. Change region`}
        accessibilityRole="button"
        disabled={!region.ready}
        onPress={() => { setQuery(''); setVisible(true); }}
        style={styles.button}
      >
        <Text style={styles.label}>{region.country ?? 'Region'}</Text>
        <ChevronDown color={colors.textMuted} size={14} />
      </Pressable>
      <BottomActionSheet onClose={() => setVisible(false)} title="Watch region" visible={visible}>
        <TextInput
          accessibilityLabel="Search regions"
          autoCapitalize="none"
          autoCorrect={false}
          onChangeText={setQuery}
          placeholder="Search regions"
          placeholderTextColor={colors.textSubtle}
          style={styles.search}
          value={query}
        />
        <BottomActionSheetScrollView>
          {region.storefront ? (
            <Pressable accessibilityRole="radio" accessibilityState={{ checked: !region.override }} onPress={() => void select(null)} style={styles.row}>
              <Text style={styles.name}>App Store region ({region.storefront})</Text>
              {!region.override ? <Check color={colors.text} size={18} /> : null}
            </Pressable>
          ) : (
            <Text style={styles.hint}>Choose where you watch. Your App Store region is unavailable.</Text>
          )}
          {matches.length === 0 ? <Text style={styles.hint}>No regions found.</Text> : null}
          {matches.map((item) => (
            <Pressable accessibilityRole="radio" accessibilityState={{ checked: region.override === item.code }} key={item.code} onPress={() => void select(item.code)} style={styles.row}>
              <Text style={styles.name}>{item.name}</Text>
              {region.override === item.code ? <Check color={colors.text} size={18} /> : null}
            </Pressable>
          ))}
        </BottomActionSheetScrollView>
      </BottomActionSheet>
    </>
  );
}

const styles = StyleSheet.create({
  button: { alignItems: 'center', flexDirection: 'row', gap: spacing.xs, minHeight: 44, paddingHorizontal: spacing.sm },
  label: { ...typography.meta, color: colors.textMuted },
  search: { ...typography.body, backgroundColor: colors.panelSoft, borderRadius: radii.sm, color: colors.text, minHeight: 44, padding: spacing.sm },
  row: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm, minHeight: 48, paddingVertical: spacing.sm },
  name: { ...typography.body, color: colors.text, flex: 1 },
  hint: { ...typography.meta, color: colors.textMuted, paddingVertical: spacing.sm },
});
