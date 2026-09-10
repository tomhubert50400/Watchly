import { StyleSheet, Switch, Text, View } from 'react-native';
import { BottomActionSheet, BottomActionSheetScrollView } from '../components/BottomActionSheet';
import { Button } from '../components/Button';
import { colors, spacing, typography } from '../design/tokens';
import { useSpoilerPreferences } from './useSpoilerPreferences';

export function SpoilerSettingsSheet({ userId, visible, onClose }: { userId: string; visible: boolean; onClose: () => void }) {
  const state = useSpoilerPreferences(userId);
  const preferences = state.preferences;
  const choices = [
    ['unwatchedEpisodes', 'Unwatched episodes'],
    ['unwatchedMovies', 'Unwatched movies'],
    ['watchlist', 'Unwatched titles in my watchlist'],
  ] as const;
  return (
    <BottomActionSheet visible={visible} onClose={onClose} title="Spoiler protection">
      <BottomActionSheetScrollView>
        <Text style={styles.body}>Blur Community posts that match any selected rule. Reveal each post whenever you want. Saved for your account on this device.</Text>
        <View style={styles.row}>
          <Text style={styles.label}>Enable spoiler protection</Text>
          <Switch accessibilityLabel="Enable spoiler protection" disabled={!state.loaded} value={preferences.enabled} onValueChange={(enabled) => void state.save({ enabled })} trackColor={{ true: colors.accent }} thumbColor={colors.text} />
        </View>
        {preferences.enabled ? <>
          {choices.map(([key, label]) => <View key={key} style={styles.row}>
            <Text style={styles.label}>{label}</Text>
            <Switch accessibilityLabel={label} disabled={!state.loaded} value={preferences[key]} onValueChange={(value) => void state.save({ [key]: value })} trackColor={{ true: colors.accent }} thumbColor={colors.text} />
          </View>)}
          <Text style={styles.label}>Recent releases</Text>
          <View style={styles.options}>
            {([0, 3, 7, 14] as const).map((days) => <Button compact key={days} label={days ? `${days} days` : 'Off'} accessibilityState={{ selected: preferences.recentDays === days }} disabled={!state.loaded} variant={preferences.recentDays === days ? 'primary' : 'secondary'} onPress={() => void state.save({ recentDays: days })} />)}
          </View>
          <Text style={styles.body}>Uses the movie release date or episode air date, not the post date. Unknown dates are protected too.</Text>
        </> : null}
        {state.error ? <Text accessibilityRole="alert" style={styles.body}>{state.error}</Text> : null}
        {!state.loaded && state.error ? <Button label="Retry" onPress={() => void state.retry()} /> : null}
      </BottomActionSheetScrollView>
    </BottomActionSheet>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md, paddingVertical: spacing.md },
  label: { ...typography.body, color: colors.text, flexShrink: 1 },
  body: { ...typography.body, color: colors.textMuted, marginVertical: spacing.sm },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginVertical: spacing.md },
});
