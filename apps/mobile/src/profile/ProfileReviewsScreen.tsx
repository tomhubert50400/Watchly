import { useEffect, useMemo, useRef, useState } from 'react';
import { useIsFocused } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ChevronLeft } from 'lucide-react-native';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getProfileReviews } from '../api/profile';
import { useAuthSession } from '../auth/AuthSessionContext';
import { getOrCreateResourceRequest, setMemoryResource } from '../cache/memoryResourceCache';
import { getPrivateCacheKey } from '../cache/persistedCache';
import { useCatalogueCache } from '../catalogue/CatalogueCacheContext';
import { AppHeader } from '../components/AppHeader';
import { Button } from '../components/Button';
import { EmptyState } from '../components/EmptyState';
import { TextInput } from '../components/TextInput';
import { colors, spacing, typography } from '../design/tokens';
import type { RootStackParamList } from '../navigation/types';
import { useUserDataRevision } from '../sync/userDataEvents';
import { getHydratedProfileOpinionTarget, ProfileReviewCard } from './ProfileBody';
import { ProfileHeaderButton } from './ProfileHeaderButton';
import { getCachedProfileReviews, type ProfileReviewsCache } from './profileReviewsCache';
import { ProfileReviewsSkeleton } from './ProfileReviewsSkeleton';
import { hydrateSearchableReview, matchesProfileReview, reviewFallback, type SearchableProfileReview } from './profileReviewsModel';

export function ProfileReviewsScreen({ navigation, route }: NativeStackScreenProps<RootStackParamList, 'ProfileReviews'>) {
  const { currentUser, firebaseIdToken } = useAuthSession();
  const { refreshMovie, refreshSeries } = useCatalogueCache();
  const isFocused = useIsFocused();
  const revision = useUserDataRevision('opinions', 'profile', 'socialGraph');
  const cacheKey = getPrivateCacheKey(currentUser?.id ?? 'signed-out', `profile:reviews:${route.params.userId}:${revision}:v1`);
  const cached = firebaseIdToken ? getCachedProfileReviews(cacheKey) : null;
  const [items, setItems] = useState<SearchableProfileReview[]>(() => cached?.data.items ?? []);
  const [hydratedCount, setHydratedCount] = useState(() => cached?.data.hydratedCount ?? 0);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(!cached);
  const [indexing, setIndexing] = useState(Boolean(cached && cached.data.hydratedCount < cached.data.items.length));
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const handledRetry = useRef(0);
  const listRef = useRef<FlatList<SearchableProfileReview>>(null);

  useEffect(() => {
    let cancelled = false;
    if (!isFocused) return;
    const forceReload = handledRetry.current !== retry;
    handledRetry.current = retry;
    const entry = !forceReload && firebaseIdToken ? getCachedProfileReviews(cacheKey) : null;
    setItems(entry?.data.items ?? []);
    setHydratedCount(entry?.data.hydratedCount ?? 0);
    setLoading(!entry);
    setIndexing(Boolean(entry && entry.data.hydratedCount < entry.data.items.length));
    setError(null);
    async function load() {
      if (!firebaseIdToken) throw new Error('Sign in again to view reviews.');
      if (entry && entry.data.hydratedCount === entry.data.items.length) return;
      const response = entry ? null : await getOrCreateResourceRequest(
        cacheKey, () => getProfileReviews(firebaseIdToken, route.params.userId),
      );
      if (cancelled) return;
      const next = entry ? [...entry.data.items] : response!.items.map(reviewFallback);
      const savedAt = entry?.savedAt ?? new Date().toISOString();
      function publish(completed: number) {
        const snapshot: ProfileReviewsCache = { items: [...next], hydratedCount: completed };
        setMemoryResource(cacheKey, snapshot, savedAt);
        setItems(snapshot.items);
        setHydratedCount(completed);
      }
      publish(entry?.data.hydratedCount ?? 0);
      setLoading(false);
      setIndexing(true);
      for (let start = entry?.data.hydratedCount ?? 0; start < next.length; start += 4) {
        if (cancelled) return;
        const batch = await Promise.all(next.slice(start, start + 4)
          .map((item) => hydrateSearchableReview(item, refreshMovie, refreshSeries)));
        if (cancelled) return;
        next.splice(start, batch.length, ...batch);
        publish(start + batch.length);
      }
      setIndexing(false);
    }
    void load().catch((reason) => {
      if (cancelled) return;
      setError(reason instanceof Error ? reason.message : 'Could not load reviews.');
      setLoading(false);
      setIndexing(false);
    });
    return () => { cancelled = true; };
  }, [cacheKey, firebaseIdToken, isFocused, refreshMovie, refreshSeries, retry, route.params.userId]);

  const results = useMemo(() => items.filter((item) => matchesProfileReview(item, query)), [items, query]);
  const incomplete = !indexing && items.some((item) => item.metadataUnavailable);

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <AppHeader title="Reviews" leading={(
          <ProfileHeaderButton accessibilityLabel="Back" onPress={() => navigation.goBack()}>
            <ChevronLeft color={colors.text} size={30} strokeWidth={2} />
          </ProfileHeaderButton>
        )} />
        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          clearButtonMode="while-editing"
          label="Search reviews"
          onChangeText={(value) => {
            setQuery(value);
            listRef.current?.scrollToOffset({ animated: false, offset: 0 });
          }}
          placeholder="Title, actor, words in a review..."
          returnKeyType="search"
          value={query}
        />
        {!loading && !error ? <Text style={styles.meta}>{results.length} {results.length === 1 ? 'review' : 'reviews'}</Text> : null}
        {indexing ? <Text accessibilityLiveRegion="polite" style={styles.meta}>Loading titles and cast. Search results will update.</Text> : null}
        {incomplete ? (
          <View>
            <Text style={styles.meta}>Some titles or cast could not load. You can still search review text.</Text>
            <Button compact label="Retry details" onPress={() => setRetry((value) => value + 1)} variant="secondary" />
          </View>
        ) : null}
      </View>
      <FlatList
        automaticallyAdjustKeyboardInsets
        contentContainerStyle={styles.list}
        data={results}
        keyExtractor={(item) => `${item.type}:${item.id}`}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        ref={listRef}
        ListEmptyComponent={loading ? <ProfileReviewsSkeleton /> : error ? (
          <EmptyState title="Reviews unavailable" body={error}>
            <Button compact label="Retry" onPress={() => setRetry((value) => value + 1)} />
          </EmptyState>
        ) : indexing ? <ProfileReviewsSkeleton /> : (
          <EmptyState title={query.trim() ? 'No matching reviews' : 'No reviews yet'} body={query.trim() ? 'Try another title, actor, or word.' : 'Written reviews will appear here.'} />
        )}
        renderItem={({ item }) => items.indexOf(item) >= hydratedCount ? <ProfileReviewsSkeleton count={1} /> : (
          <ProfileReviewCard item={item} onOpenContent={() => {
            if (item.content.contentType === 'episode' && !item.seriesTitle) {
              navigation.navigate('SeriesDetail', { tmdbId: item.content.seriesTmdbId, title: 'Series' });
              return;
            }
            const target = getHydratedProfileOpinionTarget(item);
            if (target.name === 'FilmDetail') navigation.navigate(target.name, target.params);
            else if (target.name === 'EpisodeDetail') navigation.navigate(target.name, target.params);
            else navigation.navigate(target.name, target.params);
          }} />
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.background, flex: 1 },
  header: { gap: spacing.md, paddingHorizontal: spacing.xl, paddingTop: spacing.sm, paddingBottom: spacing.md },
  list: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxxl },
  meta: { ...typography.meta, color: colors.textMuted },
});
