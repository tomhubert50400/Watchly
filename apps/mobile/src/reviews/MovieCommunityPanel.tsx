import { ChevronDown, ChevronUp, Flag } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import type { ReportTarget } from '../api/reports';
import type { DisplayRating } from '../api/catalogue';
import { getMovieCommunity, type MovieCommunityResponse } from '../api/reviews';
import { useAuthSession } from '../auth/AuthSessionContext';
import { useCachedResource } from '../cache/useCachedResource';
import { getPrivateCacheKey, getPublicCacheKey } from '../cache/persistedCache';
import { Button } from '../components/Button';
import { StarRatingDisplay } from '../components/StarRatingDisplay';
import { UserAvatar } from '../components/UserAvatar';
import { colors, radii, spacing, typography } from '../design/tokens';
import { ReportSheet } from '../reports/ReportSheet';
import { useUserDataRevision } from '../sync/userDataEvents';
import { getRatingDistribution } from './ratingDistribution';

export function MovieCommunityPanel({ tmdbId, displayRating, onViewMore }: {
  tmdbId: number;
  displayRating?: DisplayRating | null;
  onViewMore: () => void;
}) {
  const { currentUser, firebaseIdToken, getFirebaseIdToken } = useAuthSession();
  const revision = useUserDataRevision('opinions', 'socialGraph', 'profile');
  const [expanded, setExpanded] = useState(false);
  const [selectedScore, setSelectedScore] = useState<number | null>(null);
  const { width } = useWindowDimensions();
  const load = useCallback(async () => getMovieCommunity(
    firebaseIdToken ? await getFirebaseIdToken() : null, tmdbId,
  ), [firebaseIdToken, getFirebaseIdToken, tmdbId]);
  const resource = useCachedResource<MovieCommunityResponse>({
    key: currentUser
      ? getPrivateCacheKey(currentUser.id, `movie-community:${tmdbId}:${revision}`)
      : getPublicCacheKey(`movie-community:${tmdbId}:${revision}`),
    load,
  });
  const community = resource.data ? getRatingDistribution(resource.data, displayRating) : null;
  const maxCount = Math.max(1, ...community?.distribution.map((bucket) => bucket.count) ?? []);
  const selectedBucket = community?.distribution.find((bucket) => bucket.score === selectedScore);

  return (
    <View style={styles.section}>
      <Text style={styles.title}>Ratings & reviews</Text>
      {community ? (
        <>
          {community.estimated ? <Text accessibilityLabel="Estimated distribution based on the average rating and total votes, not individual votes" style={styles.muted}>Estimated distribution</Text> : null}
          <View style={styles.ratingRow}>
            <View style={styles.chart}>
              <View style={styles.histogram}>
                {community.distribution.map((bucket) => (
                  <Pressable
                    key={bucket.score}
                    accessibilityRole="button"
                    accessibilityLabel={`${bucket.score} stars: ${community.estimated ? 'approximately ' : ''}${bucket.count} ${community.estimated ? 'estimated ' : ''}ratings`}
                    accessibilityState={{ selected: selectedScore === bucket.score }}
                    onPress={() => setSelectedScore((current) => current === bucket.score ? null : bucket.score)}
                    style={styles.bucket}
                  >
                    <View style={[styles.bar, {
                      height: bucket.count > 0 ? Math.max(3, bucket.count / maxCount * 56) : 1,
                      backgroundColor: selectedScore === bucket.score ? colors.accentText : bucket.count > 0 ? colors.rating : colors.ratingBorder,
                      opacity: selectedScore !== null && selectedScore !== bucket.score ? 0.5 : 1,
                    }]} />
                  </Pressable>
                ))}
              </View>
              <View style={styles.axis}><Text style={styles.axisLabel}>½★</Text><Text style={styles.axisLabel}>5★</Text></View>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={selectedBucket ? `${community.estimated ? 'Approximately ' : ''}${selectedBucket.count} ${community.estimated ? 'estimated ' : ''}ratings of ${selectedBucket.score} stars. Show average rating` : `${community.estimated ? 'Average used for estimated distribution' : 'Watchly average'}: ${community.averageScore ?? 'no ratings'}`}
              accessibilityLiveRegion="polite"
              onPress={() => setSelectedScore(null)}
              style={styles.ratingSummary}
            >
              <Text adjustsFontSizeToFit numberOfLines={1} style={styles.summaryValue}>
                {selectedBucket ? `${community.estimated ? '≈ ' : ''}${selectedBucket.count.toLocaleString()}` : community.averageScore?.toFixed(1) ?? '-'}
              </Text>
              <StarRatingDisplay rating={selectedBucket?.score ?? community.averageScore ?? 0} size={13} />
            </Pressable>
          </View>
          {community.reviewCount > 0 ? <Pressable accessibilityRole="button" accessibilityState={{ expanded }} onPress={() => setExpanded(!expanded)} style={styles.toggle}>
              <Text style={styles.author}>{expanded ? 'Hide reviews' : `Show reviews (${community.reviewCount})`}</Text>
            {expanded ? <ChevronUp color={colors.textMuted} size={20} /> : <ChevronDown color={colors.textMuted} size={20} />}
          </Pressable> : null}
          {expanded ? (
            <>
              {community.reviews.length ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
                  {community.reviews.map((review) => (
                    <View key={review.id} style={{ width: Math.min(320, width - spacing.xl * 2 - spacing.md) }}>
                      <MovieCommunityReviewCard review={review} compact />
                    </View>
                  ))}
                </ScrollView>
              ) : null}
              {community.reviewCount > 0 ? <Button label="View more" variant="secondary" onPress={onViewMore} /> : null}
            </>
          ) : null}
        </>
      ) : <Text style={styles.muted}>{resource.error ? 'Could not load ratings and reviews.' : 'Loading ratings and reviews…'}</Text>}
      {resource.error ? <Button label="Retry" variant="ghost" onPress={resource.retry} /> : null}
    </View>
  );
}

export function MovieCommunityReviewCard({ review, compact = false }: {
  review: MovieCommunityResponse['reviews'][number];
  compact?: boolean;
}) {
  const { currentUser } = useAuthSession();
  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null);
  return (
    <View style={styles.card}>
      <View style={styles.reviewHeader}>
        <UserAvatar avatarUrl={review.author.avatarUrl} displayName={review.author.displayName} size={32} />
        <Text numberOfLines={1} style={styles.author}>{review.author.displayName?.trim() || 'Watchly member'}</Text>
        {currentUser && currentUser.id !== review.author.id ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Report review" style={styles.report} onPress={() => setReportTarget({ id: review.id, type: 'movieReview', label: `Review by ${review.author.displayName || 'Watchly member'}` })}>
            <Flag color={colors.textSubtle} size={17} />
          </Pressable>
        ) : null}
      </View>
      <StarRatingDisplay rating={review.score} size={17} />
      <Text style={styles.muted}>{new Date(review.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</Text>
      <Text numberOfLines={compact ? 5 : undefined} style={styles.body}>{review.body}</Text>
      <ReportSheet target={reportTarget} onClose={() => setReportTarget(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.md, paddingVertical: spacing.xl, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  title: { ...typography.title, color: colors.text },
  muted: { ...typography.meta, color: colors.textSubtle },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  chart: { flex: 1, minWidth: 0 },
  histogram: { flexDirection: 'row', height: 60, gap: 2, alignItems: 'flex-end' },
  bucket: { flex: 1, height: '100%', justifyContent: 'flex-end' },
  bar: { width: '100%', borderTopLeftRadius: 2, borderTopRightRadius: 2 },
  axis: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 5 },
  axisLabel: { color: colors.textSubtle, fontSize: 10 },
  ratingSummary: { width: 82, minHeight: 60, justifyContent: 'center', alignItems: 'center', gap: 3 },
  summaryValue: { color: colors.text, fontSize: 26, lineHeight: 32, fontWeight: '500', fontVariant: ['tabular-nums'], textAlign: 'center', width: '100%' },
  toggle: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  rail: { gap: spacing.md, alignItems: 'stretch' },
  card: { flex: 1, padding: spacing.md, gap: spacing.sm, backgroundColor: colors.panelElevated, borderWidth: 1, borderColor: colors.border, borderRadius: radii.lg },
  reviewHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  author: { ...typography.body, color: colors.text, fontWeight: '700', flex: 1 },
  body: { ...typography.body, color: colors.textMuted },
  report: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
});
