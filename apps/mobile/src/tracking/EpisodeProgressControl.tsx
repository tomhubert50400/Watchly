import { CheckCircle2, PlayCircle } from 'lucide-react-native';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SegmentedControl } from '../components/SegmentedControl';
import { colors, spacing } from '../design/tokens';
import { isEpisodeWatched } from '../episodes/episodeModel';
import { useSeasonEpisodes } from '../episodes/useSeasonEpisodes';

type Props = {
  episodeNumber: number;
  seasonNumber: number;
  seriesTmdbId: number;
};

type Status = 'watching' | 'watched';

const statusOptions: { Icon: typeof PlayCircle; label: string; value: Status }[] = [
  { Icon: PlayCircle, label: 'Watching', value: 'watching' },
  { Icon: CheckCircle2, label: 'Watched', value: 'watched' },
];

export function EpisodeProgressControl({ episodeNumber, seasonNumber, seriesTmdbId }: Props) {
  const model = useSeasonEpisodes({ loadSeason: false, seasonNumber, seriesTmdbId });
  const watched = isEpisodeWatched(model.watchedState, seasonNumber, episodeNumber);
  const currentStatus: Status = watched ? 'watched' : 'watching';

  if (!model.isSignedIn) {
    return null;
  }

  return (
    <View style={styles.container}>
      <SegmentedControl<Status>
        buttonMinHeight={46}
        onChange={(status) => void model.setEpisodeWatched(episodeNumber, status === 'watched')}
        options={statusOptions.map(({ Icon, label, value }) => ({
          accessibilityLabel: `Set ${label}`,
          label,
          render: ({ selected }) => (
            <View style={styles.statusContent}>
              <Icon color={selected ? colors.textOnAccent : colors.text} size={16} strokeWidth={2.2} />
              <Text numberOfLines={1} style={[styles.statusLabel, selected && styles.statusLabelSelected]}>
                {label}
              </Text>
            </View>
          ),
          value,
        }))}
        value={currentStatus}
      />
      {model.isSaving || model.isRefreshing ? (
        <View style={styles.loadingOverlay} pointerEvents="none">
          <ActivityIndicator color={colors.textOnAccent} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: spacing.md, position: 'relative' },
  loadingOverlay: { alignItems: 'center', bottom: 0, justifyContent: 'center', left: 0, position: 'absolute', right: 0, top: 0 },
  statusContent: { alignItems: 'center', flexDirection: 'row', gap: spacing.xs, justifyContent: 'center', minWidth: 0 },
  statusLabel: { color: colors.text, fontSize: 14, fontWeight: '800', textAlign: 'center' },
  statusLabelSelected: { color: colors.textOnAccent },
});
