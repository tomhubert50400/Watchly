import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { HorizontalScrollFade } from '../components/HorizontalScrollFade';
import { Button } from '../components/Button';
import { InlineStatusBanner } from '../components/InlineStatusBanner';
import { LoadingState } from '../components/LoadingState';
import { MediaPoster } from '../components/MediaPoster';
import { PosterActionsMenu } from '../components/PosterActionsMenu';
import { ScreenReveal } from '../components/ScreenReveal';
import { SectionHeader } from '../components/SectionHeader';
import { colors, spacing, typography } from '../design/tokens';
import { LibraryData } from '../library/useLibraryData';
import { RootStackParamList } from '../navigation/types';
import { type HomeWatchlistItem, selectHomeWatchlistItems } from '../watchlists/watchlistHomeModel';
import { useWatchlistRemoval } from '../watchlists/useWatchlistRemoval';

export function HomeWatchlists({ data, error, loading, onRetry }: { data: LibraryData | null; error: string | null; loading: boolean; onRetry: () => void }) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const items = selectHomeWatchlistItems(data?.lists ?? []);
  const openLists = () => navigation.navigate('MainTabs', { screen: 'Library' });
  return <ScreenReveal delay={110} style={styles.section}>
    <View style={styles.header}><SectionHeader title="From your watchlists" actionLabel="View all" onActionPress={openLists} /></View>
    {loading && !data ? <View style={styles.header}><LoadingState label="Loading watchlists" /></View>
      : error && !data ? <View style={styles.header}><InlineStatusBanner detail={error} onRetry={onRetry} tone="error" /></View>
      : items.length ? <HorizontalScrollFade><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
        {items.map((item) => <HomeWatchlistCard item={item} key={`${item.listKind}:${item.listId}:${item.contentType}:${item.tmdbId}`} />)}
      </ScrollView></HorizontalScrollFade>
      : <View style={styles.header}><Text style={styles.empty}>{data?.lists.length
        ? data.lists.some((list) => list.showOnHome !== false)
          ? 'Add titles to your watchlists to find them here.'
          : 'Choose a watchlist to show here in its settings.'
        : 'Keep your next movies and series in a watchlist.'}</Text><Button label="Open watchlists" onPress={openLists} /></View>}
  </ScreenReveal>;
}

function HomeWatchlistCard({ item }: { item: HomeWatchlistItem }) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const removal = useWatchlistRemoval({
    kind: item.listKind, watchlistId: item.listId, name: item.listName, isPlanned: item.isPlanned,
    onRemoved: () => {},
  });
  return <View style={styles.item}>
    <PosterActionsMenu enabled actionLabel={`Remove from ${item.listName}`} label={`Open ${item.title}`}
      title={item.title} width={124}
      onOpen={() => navigation.navigate(item.contentType === 'movie' ? 'FilmDetail' : 'SeriesDetail', { title: item.title, tmdbId: item.tmdbId })}
      onRemove={() => removal.removeDroppedItem({ ...item, id: `${item.contentType}:${item.tmdbId}` })}>
      <MediaPoster posterUrl={item.posterUrl} style={styles.poster} />
    </PosterActionsMenu>
    <Pressable accessibilityRole="button" accessibilityLabel={`Open watchlist ${item.listName}`} onPress={() => navigation.navigate(item.listKind === 'personal' ? 'PersonalWatchlist' : 'SharedWatchlist', { title: item.listName, watchlistId: item.listId })} style={styles.source}>
      <Text numberOfLines={2} style={styles.sourceText}>{item.listName}</Text>
    </Pressable>
  </View>;
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm },
  header: { paddingHorizontal: spacing.xl, gap: spacing.sm },
  rail: { paddingHorizontal: spacing.xl, gap: spacing.md },
  item: { width: 124 },
  poster: { width: 124, height: 186 },
  source: { minHeight: 44, justifyContent: 'center' },
  sourceText: { ...typography.body, fontSize: 12, color: colors.textMuted },
  empty: { ...typography.body, color: colors.textMuted },
});
