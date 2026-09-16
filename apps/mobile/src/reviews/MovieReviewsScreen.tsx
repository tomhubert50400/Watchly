import { useIsFocused } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useRef, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getMovieCommunity, type MovieCommunityResponse } from '../api/reviews';
import { useAuthSession } from '../auth/AuthSessionContext';
import { Button } from '../components/Button';
import { ScreenReveal } from '../components/ScreenReveal';
import { colors, spacing, typography } from '../design/tokens';
import type { RootStackParamList } from '../navigation/types';
import { useUserDataRevision } from '../sync/userDataEvents';
import { MovieCommunityReviewCard } from './MovieCommunityPanel';

export function MovieReviewsScreen({ route }: NativeStackScreenProps<RootStackParamList, 'MovieReviews'>) {
  const { currentUser, firebaseIdToken, getFirebaseIdToken } = useAuthSession();
  const focused = useIsFocused();
  const revision = useUserDataRevision('opinions', 'socialGraph', 'profile');
  const [items, setItems] = useState<MovieCommunityResponse['reviews']>([]);
  const [nextPage, setNextPage] = useState<number | null>(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const generation = useRef(0);
  const busy = useRef(false);

  useEffect(() => {
    const requestGeneration = ++generation.current;
    busy.current = false;
    setItems([]);
    setNextPage(1);
    setError(false);
    if (!focused) return;
    busy.current = true;
    setLoading(true);
    async function load() {
      const token = firebaseIdToken ? await getFirebaseIdToken() : null;
      const response = await getMovieCommunity(token, route.params.tmdbId, 1, 20);
      if (generation.current !== requestGeneration) return;
      setItems(response.reviews);
      setNextPage(response.nextPage);
    }
    void load().catch(() => {
      if (generation.current === requestGeneration) setError(true);
    }).finally(() => {
      if (generation.current === requestGeneration) { setLoading(false); busy.current = false; }
    });
    return () => { generation.current++; };
  }, [currentUser?.id, firebaseIdToken, focused, getFirebaseIdToken, retry, revision, route.params.tmdbId]);

  async function loadMore() {
    if (busy.current || nextPage === null) return;
    if (items.length === 0) { setRetry((value) => value + 1); return; }
    const requestGeneration = generation.current;
    busy.current = true;
    setLoading(true);
    setError(false);
    try {
      const token = firebaseIdToken ? await getFirebaseIdToken() : null;
      const response = await getMovieCommunity(token, route.params.tmdbId, nextPage, 20);
      if (generation.current !== requestGeneration) return;
      setItems((previous) => [...previous, ...response.reviews.filter((item) => !previous.some((existing) => existing.id === item.id))]);
      setNextPage(response.nextPage);
    } catch {
      if (generation.current === requestGeneration) setError(true);
    } finally {
      if (generation.current === requestGeneration) { setLoading(false); busy.current = false; }
    }
  }

  return (
    <SafeAreaView edges={['bottom']} style={styles.screen}>
      <ScreenReveal ready={!loading || items.length > 0} style={styles.screen}>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListHeaderComponent={<View style={styles.header}><Text style={styles.title}>{route.params.title}</Text><Text style={styles.muted}>Watchly reviews · Newest first</Text></View>}
        renderItem={({ item }) => <MovieCommunityReviewCard review={item} artworkUrl={route.params.artworkUrl} />}
        ListEmptyComponent={<Text style={styles.muted}>{loading ? 'Loading reviews…' : error ? 'Could not load reviews.' : 'No written reviews yet.'}</Text>}
        ListFooterComponent={<View style={styles.footer}>
          {error && items.length > 0 ? <Text style={styles.muted}>Could not load more reviews.</Text> : null}
          {nextPage !== null ? <Button label={error ? 'Retry' : 'Load more'} loading={loading} variant="secondary" onPress={() => void loadMore()} /> : null}
        </View>}
      />
      </ScreenReveal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.xl },
  header: { gap: spacing.sm, marginBottom: spacing.xl },
  title: { ...typography.title, color: colors.text },
  muted: { ...typography.body, color: colors.textSubtle },
  separator: { height: spacing.md },
  footer: { gap: spacing.sm, marginTop: spacing.lg },
});
