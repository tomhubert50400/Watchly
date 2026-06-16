import { useCallback, useEffect, useRef, useState } from 'react';
import { Plus } from 'lucide-react-native';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Image,
  LayoutAnimation,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  UIManager,
  View,
} from 'react-native';
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

type LogoProvider = StreamingProvider & {
  logoUrl: string;
};

type ProviderGroupKey = 'streaming' | 'rentBuy';

const defaultExpandedGroups: Record<ProviderGroupKey, boolean> = {
  rentBuy: false,
  streaming: false,
};

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export function StreamingAvailabilityPanel({ contentType, tmdbId }: StreamingAvailabilityPanelProps) {
  const [availability, setAvailability] = useState<StreamingAvailability | null>(null);
  const [expandedGroups, setExpandedGroups] =
    useState<Record<ProviderGroupKey, boolean>>(defaultExpandedGroups);
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

  const providerGroups = availability ? getProviderGroups(availability) : [];
  const hasProviders = providerGroups.length > 0;

  return (
    <View style={styles.panel}>
      <View>
        <Text style={styles.sectionTitle}>Where to watch</Text>
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
        <View style={styles.availabilityGroups}>
          {providerGroups.map((group) => {
            const isExpanded = expandedGroups[group.key];

            return (
              <ProviderDisclosure
                group={group}
                isExpanded={isExpanded}
                key={group.key}
                onToggle={() => {
                  animateAvailabilityToggle();
                  setExpandedGroups((current) => ({
                    ...current,
                    [group.key]: !current[group.key],
                  }));
                }}
              />
            );
          })}
        </View>
      ) : (
        <Text style={styles.emptyText}>No US provider data is available for this title yet.</Text>
      )}
    </View>
  );
}

function ProviderDisclosure({
  group,
  isExpanded,
  onToggle,
}: {
  group: { key: ProviderGroupKey; label: string; providers: LogoProvider[] };
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const rotation = useRef(new Animated.Value(isExpanded ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(rotation, {
      duration: 180,
      easing: Easing.out(Easing.cubic),
      toValue: isExpanded ? 1 : 0,
      useNativeDriver: true,
    }).start();
  }, [isExpanded, rotation]);

  const rotate = rotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '45deg'],
  });

  return (
    <View style={styles.availabilityGroup}>
      <Pressable
        accessibilityLabel={`${group.label} providers`}
        accessibilityRole="button"
        accessibilityState={{ expanded: isExpanded }}
        hitSlop={8}
        onPress={onToggle}
        style={styles.groupButton}
      >
        <Animated.View style={[styles.groupIcon, { transform: [{ rotate }] }]}>
          <Plus color={colors.accent} size={16} strokeWidth={2.4} />
        </Animated.View>
        <Text style={styles.groupLabel}>{group.label}</Text>
      </Pressable>
      {isExpanded ? (
        <View style={styles.logoRows}>
          {group.providers.map((provider) => (
            <Image
              accessibilityIgnoresInvertColors
              accessibilityLabel={`${provider.name} logo, ${group.label}`}
              key={provider.id}
              source={{ uri: provider.logoUrl }}
              style={styles.providerLogo}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

function animateAvailabilityToggle() {
  LayoutAnimation.configureNext({
    create: {
      property: LayoutAnimation.Properties.opacity,
      type: LayoutAnimation.Types.easeInEaseOut,
    },
    delete: {
      property: LayoutAnimation.Properties.opacity,
      type: LayoutAnimation.Types.easeInEaseOut,
    },
    duration: 180,
    update: {
      type: LayoutAnimation.Types.easeInEaseOut,
    },
  });
}

function getProviderGroups(availability: StreamingAvailability) {
  const streamingProviders = getLogoProviders([
    ...availability.groups.stream,
    ...availability.groups.free,
  ]);
  const rentBuyProviders = getLogoProviders([
    ...availability.groups.rent,
    ...availability.groups.buy,
  ]);
  const groups: Array<{ key: ProviderGroupKey; label: string; providers: LogoProvider[] }> = [
    { key: 'streaming', label: 'Streaming', providers: streamingProviders },
    { key: 'rentBuy', label: 'Rent / Buy', providers: rentBuyProviders },
  ];

  return groups.filter((group) => group.providers.length > 0);
}

function getLogoProviders(providers: StreamingProvider[]): LogoProvider[] {
  const providersById = new Map<number, LogoProvider>();

  providers.forEach((provider) => {
    if (provider.logoUrl && !providersById.has(provider.id)) {
      providersById.set(provider.id, { ...provider, logoUrl: provider.logoUrl });
    }
  });

  return Array.from(providersById.values());
}

const styles = StyleSheet.create({
  emptyText: {
    ...typography.body,
    color: colors.muted,
  },
  errorBlock: {
    gap: spacing.sm,
  },
  availabilityGroup: {
    gap: spacing.xs,
  },
  availabilityGroups: {
    gap: spacing.xs,
  },
  groupButton: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 34,
  },
  groupIcon: {
    alignItems: 'center',
    height: 18,
    justifyContent: 'center',
    width: 18,
  },
  groupLabel: {
    ...typography.eyebrow,
    color: colors.accent,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  loadingRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
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
    height: 38,
    width: 38,
  },
  logoRows: {
    flexDirection: 'row',
    flexWrap: 'wrap',
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
