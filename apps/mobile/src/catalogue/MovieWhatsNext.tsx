import { useCallback } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CatalogueRelatedItem, getMovieCollection } from '../api/catalogue';
import { listTrackingStates } from '../api/tracking';
import { getMovieViewingSummary } from '../api/viewings';
import { useAuthSession } from '../auth/AuthSessionContext';
import { getPrivateCacheKey, getPublicCacheKey } from '../cache/persistedCache';
import { useCachedResource } from '../cache/useCachedResource';
import { MediaPoster } from '../components/MediaPoster';
import { colors, radii, spacing, typography } from '../design/tokens';
import { useUserDataRevision } from '../sync/userDataEvents';
import { getMovieCycleWatchedIds, getNextCollectionMovie } from './whatsNextModel';

export function MovieWhatsNext({ collectionId, tmdbId, onOpen }: {
  collectionId: number;
  tmdbId: number;
  onOpen: (item: CatalogueRelatedItem) => void;
}) {
  const { currentUser, firebaseIdToken } = useAuthSession();
  const revision = useUserDataRevision('tracking', 'viewings');
  const loadCollection = useCallback(() => getMovieCollection(collectionId), [collectionId]);
  const collection = useCachedResource({
    key: getPublicCacheKey(`catalogue:collection:${collectionId}:v1`),
    load: loadCollection,
  });
  const loadTracking = useCallback(async () => {
    const [states, current] = await Promise.all([
      listTrackingStates(firebaseIdToken!, 'movie'),
      getMovieViewingSummary(firebaseIdToken!, tmdbId),
    ]);
    const watchedIds = new Set(states.filter((item) => item.status === 'watched').map((item) => item.tmdbId));
    if (current.viewCount <= 1 || !current.latestLoggedAt) return [...watchedIds];
    const ids = [...new Set((collection.data?.items ?? []).map((item) => item.tmdbId))]
      .filter((id) => id !== tmdbId && watchedIds.has(id));
    const viewings = [current];
    for (let index = 0; index < ids.length; index += 4) {
      viewings.push(...await Promise.all(ids.slice(index, index + 4)
        .map((id) => getMovieViewingSummary(firebaseIdToken!, id))));
    }
    return [...getMovieCycleWatchedIds(watchedIds, current, viewings)];
  }, [collection.data, firebaseIdToken, revision, tmdbId]);
  const tracking = useCachedResource({
    enabled: Boolean(currentUser && firebaseIdToken && collection.data),
    key: getPrivateCacheKey(currentUser?.id ?? 'visitor', `whats-next:movie-tracking:${collectionId}:${tmdbId}:v2`),
    load: loadTracking,
  });
  const waitingForTracking = Boolean(currentUser && firebaseIdToken && !tracking.data);
  const next = getNextCollectionMovie(collection.data?.items ?? [], tmdbId,
    new Set(currentUser && firebaseIdToken ? tracking.data ?? [] : []));
  const error = !collection.data ? collection.error : waitingForTracking ? tracking.error : null;
  if (!error && collection.data && !waitingForTracking && !next) return null;

  return (
    <View style={styles.section}>
      <Text style={styles.heading}>What's next</Text>
      {error ? (
        <Pressable accessibilityRole="button" onPress={() => { collection.retry(); tracking.retry(); }}>
          <Text style={styles.meta}>Could not load what's next. Tap to retry.</Text>
        </Pressable>
      ) : !next || waitingForTracking ? (
        <Text style={styles.meta}>Finding the next film…</Text>
      ) : (
        <Pressable accessibilityLabel={`Open ${next.title}`} accessibilityRole="button"
          onPress={() => onOpen(next)} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
          <MediaPoster accessibilityLabel={`${next.title} poster`} posterUrl={next.posterUrl} style={styles.poster} />
          <View style={styles.copy}>
            <Text style={styles.meta}>{collection.data?.name} · Release order</Text>
            <Text style={styles.title}>{next.title}</Text>
            <Text style={styles.meta}>Next film after this one · {next.releaseDate?.slice(0, 4)}</Text>
            <Text style={styles.link}>View film →</Text>
          </View>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', gap: spacing.md },
  copy: { flex: 1, justifyContent: 'center', gap: spacing.xs },
  heading: { ...typography.title, color: colors.text, marginBottom: spacing.md },
  link: { ...typography.meta, color: colors.accentText, marginTop: spacing.xs },
  meta: { ...typography.meta, color: colors.textMuted },
  poster: { width: 64, height: 96, borderRadius: radii.sm },
  pressed: { opacity: 0.76 },
  section: { marginTop: spacing.xl, marginBottom: spacing.lg, padding: spacing.md, backgroundColor: colors.interactiveSurface, borderColor: colors.border, borderWidth: 1, borderRadius: radii.md },
  title: { color: colors.text, fontSize: 17, fontWeight: '700' },
});
