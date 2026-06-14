import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, View } from 'react-native';
import {
  getMovieStreamingAvailability,
  getSeriesStreamingAvailability,
  StreamingAvailability,
  StreamingProvider,
} from '../api/catalogue';
import { Button } from '../components/Button';
import { colors, radii, shadows, spacing, typography } from '../design/tokens';

type StreamingAvailabilityPanelProps = {
  contentType: 'movie' | 'series';
  tmdbId: number;
};

const groupLabels: Array<{ key: keyof StreamingAvailability['groups']; label: string }> = [
  { key: 'stream', label: 'Stream' },
  { key: 'free', label: 'Free' },
  { key: 'rent', label: 'Rent' },
  { key: 'buy', label: 'Buy' },
];

export function StreamingAvailabilityPanel({ contentType, tmdbId }: StreamingAvailabilityPanelProps) {
  const [availability, setAvailability] = useState<StreamingAvailability | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const loadAvailability = useCallback(async () => {
    setError(null);
    setIsLoading(true);

    try {
      const response =
        contentType === 'movie'
          ? await getMovieStreamingAvailability(tmdbId)
          : await getSeriesStreamingAvailability(tmdbId);

      setAvailability(response.availability);
    } catch (loadError) {
      setAvailability(null);
      setError(
        loadError instanceof Error ? loadError.message : 'Could not load streaming availability.',
      );
    } finally {
      setIsLoading(false);
    }
  }, [contentType, tmdbId]);

  useEffect(() => {
    void loadAvailability();
  }, [loadAvailability]);

  const hasProviders = availability ? countProviders(availability) > 0 : false;

  return (
    <View style={styles.panel}>
      <View>
        <Text style={styles.sectionTitle}>Where to watch</Text>
        <Text style={styles.sectionBody}>
          Streaming availability in {availability?.country ?? 'US'} from TMDB.
        </Text>
      </View>
      {isLoading ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator color={colors.accent} />
          <Text style={styles.sectionBody}>Checking providers</Text>
        </View>
      ) : error ? (
        <View style={styles.errorBlock}>
          <Text style={styles.warning}>{error}</Text>
          <Button label="Retry" onPress={loadAvailability} variant="secondary" />
        </View>
      ) : availability && hasProviders ? (
        <View style={styles.groups}>
          {groupLabels.map(({ key, label }) => (
            <ProviderGroup
              key={key}
              label={label}
              providers={availability.groups[key]}
            />
          ))}
        </View>
      ) : (
        <Text style={styles.emptyText}>No US provider data is available for this title yet.</Text>
      )}
      <Text style={styles.notice}>
        Deeplinks are not validated for V1 yet, so this panel lists platforms only.
      </Text>
    </View>
  );
}

function ProviderGroup({ label, providers }: { label: string; providers: StreamingProvider[] }) {
  if (providers.length === 0) {
    return null;
  }

  return (
    <View style={styles.group}>
      <Text style={styles.groupLabel}>{label}</Text>
      <View style={styles.providerRows}>
        {providers.slice(0, 6).map((provider) => (
          <View key={provider.id} style={styles.providerRow}>
            {provider.logoUrl ? (
              <Image
                accessibilityIgnoresInvertColors
                accessibilityLabel={`${provider.name} logo`}
                source={{ uri: provider.logoUrl }}
                style={styles.providerLogo}
              />
            ) : (
              <View style={styles.providerLogoPlaceholder} />
            )}
            <Text numberOfLines={1} style={styles.providerName}>
              {provider.name}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function countProviders(availability: StreamingAvailability) {
  return Object.values(availability.groups).reduce((total, providers) => total + providers.length, 0);
}

const styles = StyleSheet.create({
  emptyText: {
    ...typography.body,
    color: colors.muted,
  },
  errorBlock: {
    gap: spacing.sm,
  },
  group: {
    gap: spacing.sm,
  },
  groupLabel: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0,
    textTransform: 'uppercase',
  },
  groups: {
    gap: spacing.md,
  },
  loadingRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
  },
  notice: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0,
  },
  panel: {
    ...shadows.panel,
    backgroundColor: colors.panelElevated,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    gap: spacing.md,
    marginBottom: spacing.md,
    padding: spacing.lg,
  },
  providerLogo: {
    backgroundColor: colors.panelSoft,
    borderRadius: radii.sm,
    height: 30,
    width: 30,
  },
  providerLogoPlaceholder: {
    backgroundColor: colors.panelSoft,
    borderColor: colors.border,
    borderRadius: radii.sm,
    borderWidth: 1,
    height: 30,
    width: 30,
  },
  providerName: {
    color: colors.text,
    flex: 1,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0,
  },
  providerRow: {
    alignItems: 'center',
    backgroundColor: colors.panel,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.sm,
  },
  providerRows: {
    gap: spacing.sm,
  },
  sectionBody: {
    ...typography.body,
    color: colors.muted,
  },
  sectionTitle: {
    ...typography.title,
    color: colors.text,
  },
  warning: {
    ...typography.body,
    color: colors.danger,
  },
});
