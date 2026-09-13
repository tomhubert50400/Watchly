import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button';
import { InlineStatusBanner } from '../components/InlineStatusBanner';
import { LoadingState } from '../components/LoadingState';
import { MediaPoster } from '../components/MediaPoster';
import { ScreenReveal } from '../components/ScreenReveal';
import { SectionHeader } from '../components/SectionHeader';
import { colors, spacing, typography } from '../design/tokens';
import { LibraryData } from '../library/useLibraryData';
import { RootStackParamList } from '../navigation/types';
import { selectHomeWatchlistItems } from '../watchlists/watchlistHomeModel';

export function HomeWatchlists({ data, error, loading, onRetry }: { data: LibraryData | null; error: string | null; loading: boolean; onRetry: () => void }) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const items = selectHomeWatchlistItems(data?.lists ?? []);
  const openLists = () => navigation.navigate('MainTabs', { screen: 'Library' });
  return <ScreenReveal delay={110} style={styles.section}>
    <View style={styles.header}><SectionHeader title="From your watchlists" actionLabel="View all" onActionPress={openLists} /></View>
    {loading && !data ? <View style={styles.header}><LoadingState label="Loading watchlists" /></View>
      : error && !data ? <View style={styles.header}><InlineStatusBanner detail={error} onRetry={onRetry} tone="error" /></View>
      : items.length ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
        {items.map((item) => <View style={styles.item} key={`${item.contentType}:${item.tmdbId}`}>
          <Pressable accessibilityRole="button" accessibilityLabel={`Open ${item.title}`} onPress={() => navigation.navigate(item.contentType === 'movie' ? 'FilmDetail' : 'SeriesDetail', { title: item.title, tmdbId: item.tmdbId })}>
            <MediaPoster posterUrl={item.posterUrl} style={styles.poster} />
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={`Open watchlist ${item.listName}`} onPress={() => navigation.navigate(item.listKind === 'personal' ? 'PersonalWatchlist' : 'SharedWatchlist', { title: item.listName, watchlistId: item.listId })} style={styles.source}>
            <Text numberOfLines={2} style={styles.sourceText}>{item.listName}</Text>
          </Pressable>
        </View>)}
      </ScrollView>
      : <View style={styles.header}><Text style={styles.empty}>{data?.lists.length ? 'Add titles to your watchlists to find them here.' : 'Keep your next movies and series in a watchlist.'}</Text><Button label="Open watchlists" onPress={openLists} /></View>}
  </ScreenReveal>;
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
