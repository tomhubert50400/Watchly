import { useCallback, useEffect, useMemo } from 'react';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import {
  CatalogueDiscoveryItem,
  getCatalogueDiscovery,
} from '../api/catalogue';
import { useCachedResource } from '../cache/useCachedResource';
import { getPublicCacheKey } from '../cache/persistedCache';
import { Button } from '../components/Button';
import { EmptyState } from '../components/EmptyState';
import { InlineStatusBanner } from '../components/InlineStatusBanner';
import { Screen } from '../components/Screen';
import { SectionHeader } from '../components/SectionHeader';
import { SpotlightAtmosphere } from '../components/SpotlightAtmosphere';
import { colors, spacing } from '../design/tokens';
import type { RootStackParamList } from '../navigation/types';
import { useCatalogueCache } from './CatalogueCacheContext';
import { ExploreMediaCard } from './ExploreMediaCard';
import { groupDiscoveryItemsByGenre } from './exploreState';

type Navigation = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'ExploreDiscovery'>;

export function ExploreDiscoveryScreen() {
  const navigation = useNavigation<Navigation>();
  const route = useRoute<Route>();
  const { preloadCatalogueItems } = useCatalogueCache();
  const load = useCallback(
    () => getCatalogueDiscovery(route.params.section, route.params.mediaType),
    [route.params.mediaType, route.params.section],
  );
  const resource = useCachedResource({
    key: getPublicCacheKey(
      `catalogue:discovery:${route.params.section}:${route.params.mediaType}:v3`,
    ),
    load,
    staleTimeMs: 15 * 60 * 1000,
  });
  const items = resource.data?.items ?? [];
  const groups = useMemo(() => groupDiscoveryItemsByGenre(items), [items]);
  const atmosphereUrl = items[0]?.posterUrl ?? null;

  useEffect(() => {
    void preloadCatalogueItems(items.map((item) => ({
      contentType: item.mediaType,
      tmdbId: item.tmdbId,
    })));
  }, [items, preloadCatalogueItems]);

  const openItem = useCallback((item: CatalogueDiscoveryItem) => {
    navigation.navigate(item.mediaType === 'movie' ? 'FilmDetail' : 'SeriesDetail', {
      title: item.title,
      tmdbId: item.tmdbId,
    });
  }, [navigation]);

  return (
    <Screen
      background={atmosphereUrl ? <SpotlightAtmosphere imageUrl={atmosphereUrl} /> : null}
      refreshControl={
        <RefreshControl
          colors={[colors.accent]}
          onRefresh={resource.retry}
          refreshing={resource.isRefreshing}
          tintColor={colors.accent}
        />
      }
      title=""
    >
      <View style={styles.content}>
        {resource.isInitialLoading && !resource.data ? (
          <InlineStatusBanner
            detail="Collecting the strongest current picks across genres."
            title={`Loading ${getDiscoveryLabel(
              route.params.section,
              route.params.mediaType,
            ).toLowerCase()}`}
            tone="updating"
          />
        ) : resource.error && !resource.data ? (
          <EmptyState body={resource.error} title="Discovery is unavailable">
            <Button label="Retry" onPress={resource.retry} />
          </EmptyState>
        ) : groups.length === 0 ? (
          <EmptyState
            body="Fresh catalogue picks will appear here when they are available."
            title="No titles to explore yet"
          />
        ) : (
          <View style={styles.groups}>
            {groups.map((group) => (
              <View key={group.genre} style={styles.group}>
                <SectionHeader
                  subtitle={`${group.items.length} ${group.items.length === 1 ? 'title' : 'titles'}`}
                  title={group.genre}
                />
                <ScrollView
                  contentContainerStyle={styles.rail}
                  horizontal
                  nestedScrollEnabled
                  showsHorizontalScrollIndicator={false}
                >
                  {group.items.map((item) => (
                    <ExploreMediaCard
                      item={item}
                      key={`${group.genre}:${item.mediaType}:${item.tmdbId}`}
                      onPress={() => openItem(item)}
                      showReleaseAlert={route.params.section === 'announced'}
                    />
                  ))}
                </ScrollView>
              </View>
            ))}
          </View>
        )}
      </View>
    </Screen>
  );
}

export function getDiscoveryLabel(
  section: 'announced' | 'trending',
  mediaType: 'movie' | 'series',
) {
  const sectionLabel = section === 'trending' ? 'Trending' : 'Coming soon';
  const mediaLabel = mediaType === 'movie' ? 'Movies' : 'TV Shows';

  return `${sectionLabel} ${mediaLabel}`;
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.xxl,
    paddingTop: spacing.lg,
  },
  group: {
    gap: spacing.sm,
  },
  groups: {
    gap: spacing.xxl,
  },
  rail: {
    gap: spacing.md,
    paddingRight: spacing.xl,
  },
});
