import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Info, Star } from 'lucide-react-native';
import { FlatList, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MediaPoster } from '../components/MediaPoster';
import { colors, radii, spacing, typography } from '../design/tokens';
import type { RootStackParamList } from '../navigation/types';
import type { ImportReviewMatch } from './importReviewModel';

type Props = NativeStackScreenProps<RootStackParamList, 'ImportMatches'>;

const MATCH_COLUMNS = 3;
const POSTER_ASPECT_RATIO = 2 / 3;

export function ImportMatchesScreen({ route }: Props) {
  const { width } = useWindowDimensions();
  const { fileName, items } = route.params;
  const cardWidth = (width - (spacing.xl * 2) - (spacing.sm * (MATCH_COLUMNS - 1))) / MATCH_COLUMNS;
  const hasSeriesRating = items.some((item) => item.contentType === 'series' && item.rating !== null);

  return (
    <SafeAreaView edges={['bottom']} style={styles.screen}>
      <FlatList
        columnWrapperStyle={styles.gridRow}
        contentContainerStyle={styles.content}
        data={items}
        ItemSeparatorComponent={GridSeparator}
        keyExtractor={(item) => `${item.contentType}:${item.tmdbId}`}
        ListFooterComponent={hasSeriesRating ? <SeriesRatingNotice /> : null}
        ListHeaderComponent={(
          <View style={styles.intro}>
            <Text accessibilityRole="header" style={styles.title}>
              {items.length} matched {items.length === 1 ? 'title' : 'titles'}
            </Text>
            <Text numberOfLines={1} style={styles.fileName}>{fileName}</Text>
            <Text style={styles.body}>Check the artwork and rating from your export before importing.</Text>
          </View>
        )}
        numColumns={MATCH_COLUMNS}
        renderItem={({ item }) => <ImportMatchCard item={item} width={cardWidth} />}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

function ImportMatchCard({ item, width }: { item: ImportReviewMatch; width: number }) {
  const ratingLabel = item.rating === null ? null : formatRating(item.rating);

  return (
    <View
      accessibilityLabel={`${item.title}, ${item.contentType === 'movie' ? 'movie' : 'series'}${ratingLabel ? `, rated ${ratingLabel} out of 5` : ', no rating'}`}
      accessible
      style={[styles.card, { width }]}
    >
      <View style={styles.posterShell}>
        <MediaPoster
          accessibilityLabel={`${item.title} poster`}
          posterUrl={item.posterUrl}
          style={{ aspectRatio: POSTER_ASPECT_RATIO, width }}
        />
        {ratingLabel ? (
          <View style={styles.ratingBadge}>
            <Star color={colors.ratingText} fill={colors.rating} size={12} strokeWidth={2} />
            <Text style={styles.ratingText}>{ratingLabel}</Text>
          </View>
        ) : null}
      </View>
      <Text numberOfLines={2} style={styles.cardTitle}>{item.title}</Text>
      <Text style={styles.contentType}>{item.contentType === 'movie' ? 'Movie' : 'Series'}</Text>
    </View>
  );
}

function GridSeparator() {
  return <View style={styles.separator} />;
}

function SeriesRatingNotice() {
  return (
    <View style={styles.notice}>
      <Info color={colors.textSubtle} size={18} strokeWidth={2} />
      <Text style={styles.noticeText}>
        Series ratings shown here come from your export. Watchly imports the title and status, then calculates series ratings from rated episodes.
      </Text>
    </View>
  );
}

function formatRating(rating: number) {
  return Number.isInteger(rating) ? rating.toFixed(0) : rating.toFixed(1);
}

const styles = StyleSheet.create({
  body: {
    ...typography.body,
    color: colors.textMuted,
  },
  card: {
    gap: spacing.xs,
  },
  cardTitle: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 17,
  },
  content: {
    paddingBottom: spacing.xxxl,
    paddingHorizontal: spacing.xl,
  },
  contentType: {
    ...typography.meta,
    color: colors.textSubtle,
    fontSize: 10,
    textTransform: 'uppercase',
  },
  fileName: {
    ...typography.meta,
    color: colors.textSubtle,
  },
  gridRow: {
    gap: spacing.sm,
  },
  intro: {
    gap: spacing.xs,
    paddingBottom: spacing.lg,
    paddingTop: spacing.lg,
  },
  notice: {
    alignItems: 'flex-start',
    backgroundColor: colors.panelSoft,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xl,
    padding: spacing.md,
  },
  noticeText: {
    ...typography.meta,
    color: colors.textMuted,
    flex: 1,
    fontWeight: '500',
  },
  posterShell: {
    position: 'relative',
  },
  ratingBadge: {
    alignItems: 'center',
    backgroundColor: colors.overlay,
    borderColor: colors.ratingBorder,
    borderRadius: radii.xs,
    borderWidth: 1,
    bottom: spacing.xs,
    flexDirection: 'row',
    gap: 3,
    paddingHorizontal: spacing.xs,
    paddingVertical: 4,
    position: 'absolute',
    right: spacing.xs,
  },
  ratingText: {
    color: colors.ratingText,
    fontSize: 11,
    fontWeight: '900',
  },
  screen: {
    backgroundColor: colors.background,
    flex: 1,
  },
  separator: {
    height: spacing.lg,
  },
  title: {
    ...typography.title,
    color: colors.text,
  },
});
