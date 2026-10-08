import { DiscoverFiltersSheet } from './DiscoverFiltersSheet';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SlidersHorizontal } from 'lucide-react-native';
import type { CatalogueSearchType } from '../api/catalogue';
import { browseGenreLabel, browseResourceKey, collectionFilters, discoverMoods, getDiscoverBrowse, type BrowseFilters } from '../api/discover';
import { getHomeCategory, homeCategoryResourceKey } from '../api/homeCategories';
import { useAuthSession } from '../auth/AuthSessionContext';
import { getPrivateCacheKey, getPublicCacheKey } from '../cache/persistedCache';
import { useCachedResource } from '../cache/useCachedResource';
import { ScreenReveal } from '../components/ScreenReveal';
import { Button } from '../components/Button';
import { EmptyState } from '../components/EmptyState';
import { LoadingState } from '../components/LoadingState';
import { InlineStatusBanner } from '../components/InlineStatusBanner';
import { Screen } from '../components/Screen';
import { SegmentedControl } from '../components/SegmentedControl';
import { SpotlightAtmosphere } from '../components/SpotlightAtmosphere';
import { colors, spacing, typography } from '../design/tokens';
import type { RootStackParamList } from '../navigation/types';
import { useUserDataRevision } from '../sync/userDataEvents';
import { discoverTypeOptions } from './DiscoverScreen';
import { ExploreMediaCard } from './ExploreMediaCard';
import { appendDiscoverBrowsePage, restoreDiscoverBrowsePages } from './discoverBrowsePages';

export function DiscoverResultsScreen() {
  const route = useRoute<RouteProp<RootStackParamList, 'DiscoverResults'>>();
  const { currentUser } = useAuthSession();
  return <DiscoverResults key={`${currentUser?.id ?? 'guest'}:${route.params.homeCategory ?? route.params.collectionId ?? 'personal'}:${route.params.country ?? 'global'}:${route.params.mood ?? 'all'}`} params={route.params} />;
}
function DiscoverResults({ params }: { params: RootStackParamList['DiscoverResults'] }) {
  const [filters, setFilters] = useState<BrowseFilters>(() => ({ ...collectionFilters(params.collectionId), ...(params.mood ? { mood: params.mood } : {}) }));
  const [showFilters, setShowFilters] = useState(false);
  const [type, setType] = useState<CatalogueSearchType>(params.mediaType);
  return <><DiscoverGrid key={browseResourceKey(filters)} type={type} onType={setType} filters={filters} onFilters={() => setShowFilters(true)} category={params.homeCategory ? params : undefined} />
    <DiscoverFiltersSheet visible={showFilters} value={filters} onClose={() => setShowFilters(false)} onApply={value => { setFilters(value); setShowFilters(false); }} /></>;
}
function DiscoverGrid({ type, onType, filters, onFilters, category }: { type: CatalogueSearchType; onType: (type: CatalogueSearchType) => void; filters: BrowseFilters; onFilters: () => void; category?: RootStackParamList['DiscoverResults'] }) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { currentUser, firebaseIdToken } = useAuthSession();
  const loadPage = useCallback((page = 1) => category?.homeCategory ? getHomeCategory(category.homeCategory, category.country, page) : getDiscoverBrowse(firebaseIdToken, filters, page), [category, firebaseIdToken, filters]);
  const load = useCallback(() => loadPage(), [loadPage]);
  const key = browseResourceKey(filters);
  const cacheKey = category?.homeCategory ? homeCategoryResourceKey(category.homeCategory, category.country) : currentUser ? getPrivateCacheKey(currentUser.id, key) : getPublicCacheKey(key);
  const resource = useCachedResource({ key: cacheKey, load, enabled: !currentUser || Boolean(firebaseIdToken) });
  const revision = useUserDataRevision('tracking', 'opinions', 'viewings', 'episodeProgress', 'watchlists');
  const lastRevision = useRef(revision);
  useEffect(() => {
    if (lastRevision.current !== revision) { lastRevision.current = revision; resource.revalidate(); }
  }, [resource.revalidate, revision]);
  const [pages, setPages] = useState(() => restoreDiscoverBrowsePages(cacheKey, resource.savedAt, resource.data?.hasMore ?? false));
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState<string | null>(null);
  const version = useRef(0);
  const busy = useRef(false);
  useEffect(() => { version.current += 1; busy.current = false; setPages(restoreDiscoverBrowsePages(cacheKey, resource.savedAt, resource.data?.hasMore ?? false)); setLoadingMore(false); setMoreError(null); }, [cacheKey, resource.data, resource.savedAt]);
  useEffect(() => () => { version.current += 1; }, []);
  const loadMore = async () => {
    if (busy.current) return;
    busy.current = true; setLoadingMore(true); setMoreError(null); const request = version.current;
    try {
      const result = await loadPage(pages.page + 1);
      if (request !== version.current) return;
      setPages(appendDiscoverBrowsePage(cacheKey, pages, result));
      if (result.partial) setMoreError('Some titles could not be loaded. Pull to refresh to try again.');
    } catch (error) { if (request === version.current) setMoreError(error instanceof Error ? error.message : 'Could not load more titles.'); }
    finally { if (request === version.current) { busy.current = false; setLoadingMore(false); } }
  };
  const items = [...new Map([...(resource.data?.items ?? []), ...pages.items].map(item => [item.id, item])).values()].filter(item => type === 'all' || item.mediaType === type);
  return <Screen contentReady={Boolean(resource.data)} title="" background={<SpotlightAtmosphere imageUrl={items[0]?.posterUrl ?? null} />} refreshControl={<RefreshControl refreshing={resource.isRefreshing} onRefresh={resource.retry} tintColor={colors.accent} />}>
    <View style={styles.content}>
      <ScreenReveal delay={0} style={styles.titleRow}>
        <Text accessibilityRole="header" style={styles.title}>{category?.title ?? 'Explore'}</Text>
        {!category ? <Pressable accessibilityRole="button" accessibilityLabel="Filters" onPress={onFilters} style={({ pressed }) => [styles.filterButton, pressed && { opacity: 0.7 }]}>
          <SlidersHorizontal size={22} color={colors.text} />
        </Pressable> : null}
      </ScreenReveal>
      {!category ? <Text style={styles.description}>{[discoverMoods.find(mood => mood.id === filters.mood)?.label, filters.genre ? browseGenreLabel(filters.genre) : null, filters.decade ? `${filters.decade}s` : null, filters.awards ? 'Award winners' : null].filter(Boolean).join(' · ') || 'All stories. Choose filters to find your next watch.'}</Text> : null}
      {(!category || category.mediaType === 'all') ? <SegmentedControl options={discoverTypeOptions} value={type} onChange={onType} /> : null}
      {resource.isInitialLoading && !resource.data ? <LoadingState variant="grid" label="Loading titles" /> : null}
      {resource.error ? <EmptyState title="Could not load this selection" body={resource.error}><Button label="Retry" onPress={resource.retry} /></EmptyState> : null}
      {resource.data?.partial ? <InlineStatusBanner title="Some titles are unavailable" detail="Pull to refresh to try again." tone="error" /> : null}
      {resource.data && !items.length ? <EmptyState title="No titles for this filter" body="Try All, or choose another selection." /> : null}
      <ScreenReveal delay={100} style={styles.grid}>{items.map(item => <ExploreMediaCard key={item.id} layout="grid" item={item} onPress={() => navigation.navigate(item.mediaType === 'movie' ? 'FilmDetail' : 'SeriesDetail', { title: item.title, tmdbId: item.tmdbId })} />)}</ScreenReveal>
      {moreError ? <Text accessibilityRole="alert" style={styles.description}>{moreError}</Text> : null}
      {pages.hasMore ? <Button disabled={loadingMore || resource.isRefreshing} label={loadingMore ? 'Loading…' : moreError ? 'Retry loading more' : 'Load more'} onPress={() => void loadMore()} /> : null}
    </View>
  </Screen>;
}
const styles = StyleSheet.create({ content: { gap: spacing.lg }, titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md }, filterButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }, title: { ...typography.heading, color: colors.text, flexShrink: 1 }, description: { ...typography.body, color: colors.muted }, grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md } });
