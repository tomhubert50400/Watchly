import { CheckCircle2, Circle } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radii, spacing, touchTargets } from '../design/tokens';
import { isEpisodeWatched } from '../episodes/episodeModel';
import { useSeasonEpisodes } from '../episodes/useSeasonEpisodes';

type Props = {
  episodeNumber: number;
  seasonNumber: number;
  seriesTmdbId: number;
  variant?: 'activity' | 'default';
};

export function EpisodeProgressControl({
  episodeNumber,
  seasonNumber,
  seriesTmdbId,
  variant = 'default',
}: Props) {
  const model = useSeasonEpisodes({ loadSeason: false, seasonNumber, seriesTmdbId });
  const watched = isEpisodeWatched(model.watchedState, seasonNumber, episodeNumber);

  if (!model.isSignedIn) {
    return null;
  }

  return (
    <View style={[styles.container, variant === 'activity' && styles.containerActivity]}>
      <Pressable
        accessibilityLabel={watched ? 'Mark episode unwatched' : 'Mark episode watched'}
        accessibilityRole="button"
        accessibilityState={{ selected: watched }}
        onPress={() => void model.setEpisodeWatched(episodeNumber, !watched)}
        style={({ pressed }) => [
          styles.button,
          variant === 'activity' && styles.buttonActivity,
          watched && styles.buttonWatched,
          pressed && styles.buttonPressed,
        ]}
      >
        {watched ? (
          <CheckCircle2 color={colors.success} size={21} strokeWidth={2.4} />
        ) : (
          <Circle color={colors.accentText} size={21} strokeWidth={2.2} />
        )}
        <Text style={[styles.label, watched && styles.labelWatched]}>
          {watched ? 'Watched' : 'Mark watched'}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  button: { alignItems: 'center', backgroundColor: colors.accentSoft, borderColor: colors.accentBorder, borderRadius: radii.md, borderWidth: 1, flexDirection: 'row', gap: spacing.sm, justifyContent: 'center', minHeight: touchTargets.min, paddingHorizontal: spacing.md },
  buttonActivity: { alignSelf: 'stretch', backgroundColor: 'transparent', minHeight: 58 },
  buttonPressed: { opacity: 0.78 },
  buttonWatched: { backgroundColor: colors.successBackground, borderColor: colors.successBorder },
  container: { marginBottom: spacing.md, position: 'relative' },
  containerActivity: { flex: 1, justifyContent: 'center', marginBottom: 0 },
  label: { color: colors.accentText, fontSize: 14, fontWeight: '800' },
  labelWatched: { color: colors.success },
});
