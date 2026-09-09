import { useCallback, useEffect, useRef, useState } from 'react';
import { Plus } from 'lucide-react-native';
import {
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
import { colors, radii, spacing, typography } from '../design/tokens';
import { useWatchRegion } from './useWatchRegion';
import { WatchRegionPicker } from './WatchRegionPicker';

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
  streaming: true,
};

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export function StreamingAvailabilityPanel({ contentType, tmdbId }: StreamingAvailabilityPanelProps) {
  const region = useWatchRegion();
  const { country } = region;
  const requestScope = `${contentType}:${tmdbId}:${country}`;
  const requestScopeRef = useRef(requestScope);
  requestScopeRef.current = requestScope;
  const [availabilityState, setAvailabilityState] = useState<{
    scope: string;
    value: StreamingAvailability | null;
  } | null>(null);
  const [expandedGroups, setExpandedGroups] =
    useState<Record<ProviderGroupKey, boolean>>(defaultExpandedGroups);

  const loadAvailability = useCallback(async () => {
    if (!country) return;
    try {
      const response =
        contentType === 'movie'
          ? await getMovieStreamingAvailability(tmdbId, country)
          : await getSeriesStreamingAvailability(tmdbId, country);

      if (requestScopeRef.current === requestScope) {
        setAvailabilityState({ scope: requestScope, value: response.availability });
      }
    } catch {
      if (requestScopeRef.current === requestScope) {
        setAvailabilityState({ scope: requestScope, value: null });
      }
    }
  }, [contentType, country, requestScope, tmdbId]);

  useEffect(() => {
    void loadAvailability();
  }, [loadAvailability]);

  const availability = availabilityState?.scope === requestScope
    ? availabilityState.value
    : null;
  const providerGroups = availability ? getProviderGroups(availability) : [];
  const hasProviders = providerGroups.length > 0;

  return (
    <View style={styles.panel}>
      <View style={styles.header}>
        <Text style={styles.sectionTitle}>Where to watch</Text>
        <WatchRegionPicker region={region} />
      </View>
      {!country ? (
        region.ready ? <Text style={styles.emptyText}>Choose a region to see where to watch.</Text> : null
      ) : !availability ? (
        availabilityState?.scope === requestScope
          ? <Text style={styles.emptyText}>Provider data is unavailable. Try again or choose another region.</Text>
          : null
      ) : hasProviders ? (
        <View style={styles.availabilityGroups}>
          {providerGroups.map((group) => {
            const isStreamingGroup = group.key === 'streaming';
            const isExpanded = isStreamingGroup || expandedGroups[group.key];

            return (
              <ProviderDisclosure
                group={group}
                isExpanded={isExpanded}
                key={group.key}
                onToggle={
                  isStreamingGroup
                    ? undefined
                    : () => {
                        animateAvailabilityToggle();
                        setExpandedGroups((current) => ({
                          ...current,
                          [group.key]: !current[group.key],
                        }));
                      }
                }
              />
            );
          })}
        </View>
      ) : (
        <Text style={styles.emptyText}>No provider data is available for this title in {country}.</Text>
      )}
      {country && availabilityState?.scope === requestScope && !availability ? (
        <Pressable accessibilityRole="button" onPress={() => void loadAvailability()} style={styles.groupButton}>
          <Text style={styles.groupLabel}>Try again</Text>
        </Pressable>
      ) : null}
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
  onToggle?: () => void;
}) {
  const rotation = useRef(new Animated.Value(isExpanded ? 1 : 0)).current;
  const canToggle = Boolean(onToggle);

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
      {canToggle ? (
        <Pressable
          accessibilityLabel={`${group.label} providers`}
          accessibilityRole="button"
          accessibilityState={{ expanded: isExpanded }}
          hitSlop={8}
          onPress={onToggle}
          style={styles.groupButton}
        >
          <Animated.View style={[styles.groupIcon, { transform: [{ rotate }] }]}>
            <Plus color={colors.textMuted} size={16} strokeWidth={2.4} />
          </Animated.View>
          <View style={styles.groupCopy}>
            <Text style={styles.groupLabel}>{group.label}</Text>
            <Text style={styles.groupMeta}>{formatProviderCount(group.providers.length)}</Text>
          </View>
        </Pressable>
      ) : (
        <View style={styles.groupButton}>
          <View style={styles.groupCopy}>
            <Text style={styles.groupLabel}>{group.label}</Text>
            <Text style={styles.groupMeta}>{formatProviderCount(group.providers.length)}</Text>
          </View>
        </View>
      )}
      {isExpanded ? (
        <View style={styles.logoRows}>
          {group.providers.map((provider) => (
            <View key={provider.id} style={styles.providerTile}>
              <Image
                accessibilityIgnoresInvertColors
                accessibilityLabel={`${provider.name} logo, ${group.label}`}
                source={{ uri: provider.logoUrl }}
                style={styles.providerLogo}
              />
              <Text numberOfLines={1} style={styles.providerName}>
                {provider.name}
              </Text>
            </View>
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

function formatProviderCount(count: number) {
  return `${count} ${count === 1 ? 'option' : 'options'}`;
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
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  emptyText: {
    ...typography.body,
    color: colors.textMuted,
  },
  availabilityGroup: {
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: spacing.sm,
    paddingTop: spacing.sm,
  },
  availabilityGroups: {
    gap: spacing.md,
  },
  groupButton: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 44,
  },
  groupCopy: {
    flex: 1,
    minWidth: 0,
  },
  groupIcon: {
    alignItems: 'center',
    backgroundColor: colors.panelSoft,
    borderColor: colors.border,
    borderRadius: radii.sm,
    borderWidth: 1,
    height: 18,
    justifyContent: 'center',
    width: 18,
  },
  groupLabel: {
    ...typography.eyebrow,
    color: colors.text,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  groupMeta: {
    ...typography.meta,
    color: colors.textSubtle,
    marginTop: 2,
  },
  panel: {
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: spacing.md,
    paddingVertical: spacing.xl,
  },
  providerLogo: {
    backgroundColor: colors.text,
    borderRadius: radii.xs,
    height: 42,
    width: 42,
  },
  logoRows: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  providerName: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  providerTile: {
    alignItems: 'center',
    width: 68,
  },
  sectionTitle: {
    ...typography.title,
    color: colors.text,
    flexShrink: 1,
  },
});
