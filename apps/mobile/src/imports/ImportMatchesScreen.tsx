import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Info, Star } from 'lucide-react-native';
import { FlatList, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MediaPoster } from '../components/MediaPoster';
import { colors, radii, spacing, typography } from '../design/tokens';
import { hapticSelection } from '../feedback/haptics';
import type { RootStackParamList } from '../navigation/types';
import type { ImportReviewMatch, ImportSkippedTitle } from './importReviewModel';

type Props = NativeStackScreenProps<RootStackParamList, 'ImportMatches'>;

const MATCH_COLUMNS = 3;
const POSTER_ASPECT_RATIO = 2 / 3;
type ReviewTab = 'matched' | 'skipped';

export function ImportMatchesScreen({ route }: Props) {
  const { width } = useWindowDimensions();
  const { matchedItems, skippedItems } = route.params;
  const [activeTab, setActiveTab] = useState<ReviewTab>(matchedItems.length > 0 ? 'matched' : 'skipped');
  const cardWidth = (width - (spacing.xl * 2) - (spacing.sm * (MATCH_COLUMNS - 1))) / MATCH_COLUMNS;
  const hasSeriesRating = matchedItems.some((item) => item.contentType === 'series' && item.rating !== null);

  const selectTab = (tab: ReviewTab) => {
    if (tab === activeTab) return;
    setActiveTab(tab);
    hapticSelection();
  };

  return (
    <SafeAreaView edges={['bottom']} style={styles.screen}>
      <View accessibilityRole="tablist" style={styles.tabs}>
        <ReviewTabButton
          active={activeTab === 'matched'}
          label={`Matched ${matchedItems.length}`}
          onPress={() => selectTab('matched')}
        />
        <ReviewTabButton
          active={activeTab === 'skipped'}
          label={`Skipped ${skippedItems.length}`}
          onPress={() => selectTab('skipped')}
        />
      </View>

      {activeTab === 'matched' ? (
        <FlatList
          columnWrapperStyle={styles.gridRow}
          contentContainerStyle={styles.content}
          data={matchedItems}
          ItemSeparatorComponent={GridSeparator}
          key="matched-imports"
          keyExtractor={(item) => `${item.contentType}:${item.tmdbId}`}
          ListEmptyComponent={<EmptyTab label="No matched titles." />}
          ListFooterComponent={hasSeriesRating ? <SeriesRatingNotice /> : null}
          numColumns={MATCH_COLUMNS}
          renderItem={({ item }) => <ImportMatchCard item={item} width={cardWidth} />}
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <FlatList
          contentContainerStyle={styles.skippedContent}
          data={skippedItems}
          ItemSeparatorComponent={SkippedSeparator}
          key="skipped-imports"
          keyExtractor={(item) => `${item.title.toLowerCase()}:${item.year ?? ''}`}
          ListEmptyComponent={<EmptyTab label="No skipped titles." />}
          renderItem={({ item }) => <SkippedTitleRow item={item} />}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

function ReviewTabButton({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.tab,
        active ? styles.tabActive : null,
        pressed ? styles.tabPressed : null,
      ]}
    >
      <Text style={[styles.tabLabel, active ? styles.tabLabelActive : null]}>{label}</Text>
    </Pressable>
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

function SkippedTitleRow({ item }: { item: ImportSkippedTitle }) {
  return (
    <View accessibilityLabel={item.year ? `${item.title}, ${item.year}` : item.title} accessible style={styles.skippedRow}>
      <Text style={styles.skippedTitle}>{item.title}</Text>
      {item.year ? <Text style={styles.skippedYear}>{item.year}</Text> : null}
    </View>
  );
}

function SkippedSeparator() {
  return <View style={styles.skippedSeparator} />;
}

function EmptyTab({ label }: { label: string }) {
  return <Text style={styles.emptyText}>{label}</Text>;
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
    paddingTop: spacing.lg,
  },
  contentType: {
    ...typography.meta,
    color: colors.textSubtle,
    fontSize: 10,
    textTransform: 'uppercase',
  },
  gridRow: {
    gap: spacing.sm,
  },
  emptyText: {
    ...typography.body,
    color: colors.textMuted,
    paddingTop: spacing.xl,
    textAlign: 'center',
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
  skippedContent: {
    flexGrow: 1,
    paddingBottom: spacing.xxxl,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
  },
  skippedRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
    minHeight: 56,
    paddingVertical: spacing.sm,
  },
  skippedSeparator: {
    backgroundColor: colors.border,
    height: StyleSheet.hairlineWidth,
  },
  skippedTitle: {
    color: colors.text,
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 20,
  },
  skippedYear: {
    ...typography.meta,
    color: colors.textSubtle,
  },
  tab: {
    alignItems: 'center',
    borderRadius: radii.sm,
    flex: 1,
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  tabActive: {
    backgroundColor: colors.accent,
  },
  tabLabel: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '800',
  },
  tabLabelActive: {
    color: colors.textOnAccent,
  },
  tabPressed: {
    opacity: 0.82,
  },
  tabs: {
    backgroundColor: colors.panelSoft,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.xs,
    marginHorizontal: spacing.xl,
    marginTop: spacing.lg,
    padding: spacing.xs,
  },
});
