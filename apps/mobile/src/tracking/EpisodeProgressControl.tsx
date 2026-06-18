import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, PlayCircle } from 'lucide-react-native';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { clearEpisodeProgress, EpisodeProgress, getEpisodeProgress, markEpisodeWatched } from '../api/progress';
import { useAuthSession } from '../auth/AuthSessionContext';
import { SegmentedControl } from '../components/SegmentedControl';
import { colors, spacing } from '../design/tokens';
import { useToast } from '../notifications/ToastContext';

type EpisodeProgressControlProps = {
  episodeNumber: number;
  seasonNumber: number;
  seriesTmdbId: number;
};

type EpisodeProgressStatus = 'watching' | 'watched';

const statusOptions: {
  Icon: typeof PlayCircle;
  label: string;
  value: EpisodeProgressStatus;
}[] = [
  { Icon: PlayCircle, label: 'Watching', value: 'watching' },
  { Icon: CheckCircle2, label: 'Watched', value: 'watched' },
];

export function EpisodeProgressControl({
  episodeNumber,
  seasonNumber,
  seriesTmdbId,
}: EpisodeProgressControlProps) {
  const { firebaseIdToken, notifyTrackingChanged } = useAuthSession();
  const { showToast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [progress, setProgress] = useState<EpisodeProgress | null>(null);

  const loadProgress = useCallback(async () => {
    if (!firebaseIdToken) {
      setProgress(null);
      return;
    }

    setIsLoading(true);

    try {
      setProgress(await getEpisodeProgress(firebaseIdToken, seriesTmdbId, seasonNumber, episodeNumber));
    } catch {
      showToast('Could not load your episode progress.');
    } finally {
      setIsLoading(false);
    }
  }, [episodeNumber, firebaseIdToken, seasonNumber, seriesTmdbId, showToast]);

  useEffect(() => {
    void loadProgress();
  }, [loadProgress]);

  async function markWatched() {
    if (!firebaseIdToken || isSaving) {
      return;
    }

    setIsSaving(true);

    try {
      setProgress(await markEpisodeWatched(firebaseIdToken, seriesTmdbId, seasonNumber, episodeNumber));
      notifyTrackingChanged();
    } catch {
      showToast('Could not save your episode progress.');
    } finally {
      setIsSaving(false);
    }
  }

  async function clearProgress() {
    if (!firebaseIdToken || isSaving || !progress) {
      return;
    }

    setIsSaving(true);

    try {
      await clearEpisodeProgress(firebaseIdToken, seriesTmdbId, seasonNumber, episodeNumber);
      setProgress(null);
      notifyTrackingChanged();
    } catch {
      showToast('Could not clear your episode progress.');
    } finally {
      setIsSaving(false);
    }
  }

  async function saveStatus(nextStatus: EpisodeProgressStatus) {
    if (nextStatus === currentStatus) {
      return;
    }

    if (nextStatus === 'watched') {
      await markWatched();
    } else {
      await clearProgress();
    }
  }

  const isWatched = progress !== null;
  const currentStatus: EpisodeProgressStatus = isWatched ? 'watched' : 'watching';

  if (!firebaseIdToken) {
    return null;
  }

  return (
    <View style={styles.container}>
      <SegmentedControl<EpisodeProgressStatus>
        buttonMinHeight={58}
        onChange={saveStatus}
        options={statusOptions.map(({ Icon, label, value }) => ({
          accessibilityLabel: `Set ${label}`,
          label,
          render: ({ selected }) => (
            <View style={styles.statusContent}>
              <Icon color={selected ? colors.textOnAccent : colors.text} size={20} strokeWidth={2.2} />
              <Text numberOfLines={1} style={[styles.statusLabel, selected && styles.statusLabelSelected]}>
                {label}
              </Text>
            </View>
          ),
          value,
        }))}
        value={currentStatus}
      />
      {isLoading || isSaving ? (
        <View style={styles.loadingOverlay} pointerEvents="none">
          <ActivityIndicator color={colors.textOnAccent} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
    position: 'relative',
  },
  loadingOverlay: {
    alignItems: 'center',
    bottom: 0,
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  statusContent: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
    justifyContent: 'center',
    minWidth: 0,
  },
  statusLabel: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0,
    textAlign: 'center',
  },
  statusLabelSelected: {
    color: colors.textOnAccent,
  },
});
