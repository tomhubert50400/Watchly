import { useCallback, useState } from 'react';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { StyleSheet, Text, View } from 'react-native';
import { getActor } from '../api/catalogue';
import { useCachedResource } from '../cache/useCachedResource';
import { getPublicCacheKey } from '../cache/persistedCache';
import { Button } from '../components/Button';
import { EmptyState } from '../components/EmptyState';
import { InlineStatusBanner } from '../components/InlineStatusBanner';
import { Screen } from '../components/Screen';
import { UserAvatar } from '../components/UserAvatar';
import { colors, spacing, typography } from '../design/tokens';
import type { RootStackParamList } from '../navigation/types';
import { ExploreMediaCard } from './ExploreMediaCard';

export function ActorDetailScreen() {
  const { params } = useRoute<RouteProp<RootStackParamList, 'ActorDetail'>>();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const load = useCallback(() => getActor(params.tmdbId), [params.tmdbId]);
  const resource = useCachedResource({ key: getPublicCacheKey(`actor:${params.tmdbId}`), load });
  const [expanded, setExpanded] = useState(false);
  const actor = resource.data?.item;
  return (
    <Screen title={actor?.name ?? params.name}>
      {!actor && resource.isInitialLoading ? <InlineStatusBanner title="Loading actor..." tone="updating" /> : null}
      {!actor && resource.error ? <EmptyState title="Could not load actor" body={resource.error}><Button label="Retry" onPress={resource.retry} /></EmptyState> : null}
      {actor ? <View style={styles.content}>
        <UserAvatar avatarUrl={actor.profileUrl} displayName={actor.name} size={112} />
        {actor.biography ? <View style={styles.biography}>
          <Text numberOfLines={expanded ? undefined : 5} style={styles.body}>{actor.biography}</Text>
          <Button label={expanded ? 'Read less' : 'Read more'} onPress={() => setExpanded(value => !value)} />
        </View> : null}
        <Text accessibilityRole="header" style={styles.heading}>Filmography</Text>
        {actor.credits.length ? <View style={styles.grid}>
          {actor.credits.map(item => <ExploreMediaCard key={item.id} item={item} layout="grid" onPress={() => navigation.push(item.mediaType === 'movie' ? 'FilmDetail' : 'SeriesDetail', { title: item.title, tmdbId: item.tmdbId })} />)}
        </View> : <Text style={styles.body}>No film or TV credits available.</Text>}
      </View> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.lg },
  biography: { gap: spacing.sm },
  body: { ...typography.body, color: colors.textMuted },
  heading: { ...typography.title, color: colors.text },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
});
