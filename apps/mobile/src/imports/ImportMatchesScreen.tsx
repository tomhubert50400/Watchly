import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Info, RotateCcw, Star } from 'lucide-react-native';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { retryImportSuggestion } from '../api/imports';
import { useAuthSession } from '../auth/AuthSessionContext';
import { MediaPoster } from '../components/MediaPoster';
import { colors, radii, spacing, typography } from '../design/tokens';
import { hapticError, hapticSelection, hapticSuccess } from '../feedback/haptics';
import type { RootStackParamList } from '../navigation/types';
import { getImportSkippedReviewRows } from './importReviewModel';
import type { ImportReviewMatch, ImportSkippedReviewRow, ImportSkippedTitle } from './importReviewModel';

type Props = NativeStackScreenProps<RootStackParamList, 'ImportMatches'>;

const MATCH_COLUMNS = 3;
const POSTER_ASPECT_RATIO = 2 / 3;
const RETRY_ALL_KEY = 'retry-all';
type ReviewTab = 'matched' | 'skipped';

export function ImportMatchesScreen({ route }: Props) {
  const { width } = useWindowDimensions();
  const { firebaseIdToken } = useAuthSession();
  const [matchedItems, setMatchedItems] = useState(route.params.matchedItems);
  const [skippedItems, setSkippedItems] = useState(route.params.skippedItems);
  const [activeTab, setActiveTab] = useState<ReviewTab>(matchedItems.length > 0 ? 'matched' : 'skipped');
  const [retryingKey, setRetryingKey] = useState<string | null>(null);
  const cardWidth = (width - (spacing.xl * 2) - (spacing.sm * (MATCH_COLUMNS - 1))) / MATCH_COLUMNS;
  const hasSeriesRating = matchedItems.some((item) => item.contentType === 'series' && item.rating !== null);
  const retryableItems = skippedItems.filter(
    (item) => item.suggestion !== null && item.retryTargets.length > 0,
  );
  const skippedRows = getImportSkippedReviewRows(skippedItems);

  const selectTab = (tab: ReviewTab) => {
    if (tab === activeTab) return;
    setActiveTab(tab);
    hapticSelection();
  };

  const retryItems = async (items: ImportSkippedTitle[], retryKey: string) => {
    if (items.length === 0) return;
    if (!firebaseIdToken) {
      Alert.alert('Session expired', 'Sign in again before retrying this title.');
      return;
    }

    const completed: ImportSkippedTitle[] = [];
    let retryError: unknown = null;
    setRetryingKey(retryKey);
    try {
      for (const item of items) {
        for (const target of item.retryTargets) {
          await retryImportSuggestion(firebaseIdToken, target.importId, target.itemIndex);
        }
        completed.push(item);
      }
    } catch (error) {
      retryError = error;
    } finally {
      if (completed.length > 0) {
        const completedKeys = new Set(completed.map(getSkippedKey));
        setSkippedItems((current) => current.filter(
          (candidate) => !completedKeys.has(getSkippedKey(candidate)),
        ));
        setMatchedItems((current) => completed.reduce(addReviewMatch, current));
      }
      setRetryingKey(null);
    }

    if (retryError) {
      Alert.alert(
        'Retry failed',
        retryError instanceof Error ? retryError.message : 'This title could not be matched.',
      );
      hapticError();
    } else {
      hapticSuccess();
    }
  };

  const retryTitle = (item: ImportSkippedTitle) =>
    retryItems([item], getSkippedKey(item));

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
          contentContainerStyle={styles.content}
          data={skippedRows}
          key="skipped-imports"
          keyExtractor={(item) => item.key}
          ListEmptyComponent={<EmptyTab label="No skipped titles." />}
          ListHeaderComponent={retryableItems.length > 0 ? (
            <RetryAllButton
              disabled={retryingKey !== null}
              loading={retryingKey === RETRY_ALL_KEY}
              onPress={() => void retryItems(retryableItems, RETRY_ALL_KEY)}
            />
          ) : null}
          renderItem={({ item }) => (
            <SkippedReviewRow
              cardWidth={cardWidth}
              disabled={retryingKey !== null}
              onRetry={(candidate) => void retryTitle(candidate)}
              retryingKey={retryingKey}
              row={item}
            />
          )}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

function RetryAllButton({
  disabled,
  loading,
  onPress,
}: {
  disabled: boolean;
  loading: boolean;
  onPress: () => void;
}) {
  return (
    <View style={styles.retryAllContainer}>
      <Pressable
        accessibilityHint="Accepts every probable match shown below."
        accessibilityRole="button"
        accessibilityState={{ busy: loading, disabled }}
        disabled={disabled}
        onPress={onPress}
        style={({ pressed }) => [
          styles.retryAllButton,
          pressed ? styles.retryAllButtonPressed : null,
          disabled && !loading ? styles.retryCardDisabled : null,
        ]}
      >
        {loading
          ? <ActivityIndicator color={colors.accentText} size="small" />
          : <RotateCcw color={colors.accentText} size={15} strokeWidth={2.4} />}
        <Text style={styles.retryAllLabel}>Retry all</Text>
      </Pressable>
    </View>
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

function SkippedReviewRow({
  cardWidth,
  disabled,
  onRetry,
  retryingKey,
  row,
}: {
  cardWidth: number;
  disabled: boolean;
  onRetry: (item: ImportSkippedTitle) => void;
  retryingKey: string | null;
  row: ImportSkippedReviewRow;
}) {
  if (row.kind === 'unmatched') {
    return <SkippedTitleRow item={row.item} startsList={row.startsList} />;
  }

  return (
    <View style={styles.suggestionGridRow}>
      {row.items.map((item) => (
        <SkippedSuggestionCard
          disabled={disabled}
          item={item}
          key={getSkippedKey(item)}
          loading={retryingKey === getSkippedKey(item)}
          onRetry={() => onRetry(item)}
          width={cardWidth}
        />
      ))}
    </View>
  );
}

function SkippedSuggestionCard({
  item,
  disabled,
  loading,
  onRetry,
  width,
}: {
  item: ImportSkippedTitle;
  disabled: boolean;
  loading: boolean;
  onRetry: () => void;
  width: number;
}) {
  const suggestion = item.suggestion;
  if (!suggestion) return null;

  const ratingLabel = item.rating === null ? null : formatRating(item.rating);
  const hasPoster = Boolean(suggestion.posterUrl);

  return (
    <Pressable
      accessibilityHint="Accepts this probable match."
      accessibilityLabel={`Retry ${item.title} as ${suggestion.title}`}
      accessibilityRole="button"
      accessibilityState={{ busy: loading, disabled }}
      disabled={disabled}
      onPress={onRetry}
      style={({ pressed }) => [
        styles.card,
        !hasPoster ? styles.retryCardWithoutPoster : null,
        { width },
        pressed ? styles.retryCardPressed : null,
        disabled && !loading ? styles.retryCardDisabled : null,
      ]}
    >
      {hasPoster ? (
        <View style={styles.posterShell}>
          <MediaPoster
            accessibilityLabel={`${suggestion.title} poster, probable match for ${item.title}`}
            posterUrl={suggestion.posterUrl}
            style={{ aspectRatio: POSTER_ASPECT_RATIO, width }}
          />
          <View style={styles.retryOverlay}>
            <View style={styles.retryIconSurface}>
              {loading
                ? <ActivityIndicator color={colors.text} size="small" />
                : <RotateCcw color={colors.text} size={22} strokeWidth={2.4} />}
            </View>
          </View>
          {ratingLabel ? (
            <View style={styles.ratingBadge}>
              <Star color={colors.ratingText} fill={colors.rating} size={12} strokeWidth={2} />
              <Text style={styles.ratingText}>{ratingLabel}</Text>
            </View>
          ) : null}
        </View>
      ) : (
        <View style={styles.compactRetryIcon}>
          {loading
            ? <ActivityIndicator color={colors.text} size="small" />
            : <RotateCcw color={colors.text} size={22} strokeWidth={2.4} />}
        </View>
      )}
      <Text numberOfLines={2} style={styles.cardTitle}>{suggestion.title}</Text>
      <View style={styles.cardMeta}>
        <Text style={styles.contentType}>{suggestion.contentType === 'movie' ? 'Movie' : 'Series'}</Text>
        {!hasPoster && ratingLabel ? (
          <View style={styles.compactRating}>
            <Star color={colors.ratingText} fill={colors.rating} size={11} strokeWidth={2} />
            <Text style={styles.ratingText}>{ratingLabel}</Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

function SkippedTitleRow({ item, startsList }: { item: ImportSkippedTitle; startsList: boolean }) {
  return (
    <>
      {startsList ? (
        <Text accessibilityRole="header" style={styles.skippedListLabel}>Couldn't match</Text>
      ) : null}
      <View
        accessibilityLabel={item.year ? `${item.title}, ${item.year}` : item.title}
        accessible
        style={[styles.skippedRow, startsList ? styles.skippedListStart : null]}
      >
        <Text style={styles.skippedTitle}>{item.title}</Text>
        {item.year ? <Text style={styles.skippedYear}>{item.year}</Text> : null}
      </View>
    </>
  );
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

function getSkippedKey(item: ImportSkippedTitle) {
  return `${item.title.toLowerCase()}:${item.year ?? ''}`;
}

function addReviewMatch(current: ImportReviewMatch[], item: ImportSkippedTitle) {
  if (!item.suggestion) return current;

  const existingIndex = current.findIndex(
    (match) => match.contentType === item.suggestion?.contentType && match.tmdbId === item.suggestion.tmdbId,
  );
  if (existingIndex < 0) {
    return [...current, {
      contentType: item.suggestion.contentType,
      posterUrl: item.suggestion.posterUrl,
      rating: item.rating,
      title: item.suggestion.title,
      tmdbId: item.suggestion.tmdbId,
    }];
  }

  if (current[existingIndex].rating !== null || item.rating === null) return current;

  return current.map((match, index) => index === existingIndex ? { ...match, rating: item.rating } : match);
}

const styles = StyleSheet.create({
  card: {
    alignSelf: 'flex-start',
    gap: spacing.xs,
  },
  cardMeta: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
    justifyContent: 'space-between',
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
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  compactRating: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 3,
  },
  compactRetryIcon: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
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
  retryCardDisabled: {
    opacity: 0.55,
  },
  retryAllButton: {
    alignItems: 'center',
    backgroundColor: colors.panelSoft,
    borderColor: colors.borderStrong,
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.xs,
    minHeight: 44,
    paddingHorizontal: spacing.md,
  },
  retryAllButtonPressed: {
    opacity: 0.78,
  },
  retryAllContainer: {
    alignItems: 'flex-end',
    marginBottom: spacing.md,
  },
  retryAllLabel: {
    color: colors.accentText,
    fontSize: 13,
    fontWeight: '800',
  },
  retryCardPressed: {
    opacity: 0.78,
  },
  retryCardWithoutPoster: {
    backgroundColor: colors.panel,
    borderColor: colors.borderStrong,
    borderRadius: radii.md,
    borderWidth: 1,
    padding: spacing.sm,
  },
  retryIconSurface: {
    alignItems: 'center',
    backgroundColor: colors.overlay,
    borderColor: colors.borderStrong,
    borderRadius: 22,
    borderWidth: 1,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  retryOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    backgroundColor: 'rgba(9, 12, 19, 0.36)',
    borderRadius: radii.md,
    justifyContent: 'center',
  },
  skippedListStart: {
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  skippedListLabel: {
    ...typography.eyebrow,
    color: colors.textSubtle,
    marginBottom: spacing.xs,
    marginTop: spacing.xs,
  },
  skippedRow: {
    alignItems: 'center',
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
    minHeight: 52,
    paddingVertical: spacing.sm,
  },
  skippedTitle: {
    color: colors.text,
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 17,
  },
  skippedYear: {
    ...typography.meta,
    color: colors.textSubtle,
  },
  suggestionGridRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
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
