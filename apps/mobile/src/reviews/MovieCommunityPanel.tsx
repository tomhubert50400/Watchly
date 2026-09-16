import { ChevronDown, ChevronUp, Flag } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import type { DisplayRating } from '../api/catalogue';
import type { ReportTarget } from '../api/reports';
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

export function MovieCommunityPanel({ tmdbId, displayRating, onViewMore }: {
  tmdbId: number;
  displayRating: DisplayRating | null;
  onViewMore: () => void;
}) {
  const { currentUser, firebaseIdToken, getFirebaseIdToken } = useAuthSession();
  const revision = useUserDataRevision('opinions', 'socialGraph', 'profile');
  const [expanded, setExpanded] = useState(false);
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
  const community = resource.data;
  const maxCount = Math.max(1, ...community?.distribution.map((bucket) => bucket.count) ?? []);

  return (
    <View style={styles.section}>
      <Text style={styles.title}>Ratings & reviews</Text>
      {displayRating ? (
        <View style={styles.summary}>
          <Text style={styles.score}>{(displayRating.average / (displayRating.scale / 5)).toFixed(1)}<Text style={styles.muted}> / 5</Text></Text>
          {displayRating.count !== null ? <Text style={styles.muted}>{displayRating.count.toLocaleString()} ratings</Text> : null}
        </View>
      ) : null}
      {community ? (
        <>
          <Text style={styles.muted}>Watchly · {community.ratingCount} public {community.ratingCount === 1 ? 'rating' : 'ratings'}</Text>
          {community.ratingCount > 0 ? (
            <View style={styles.histogram}>
              {community.distribution.map((bucket) => (
                <View key={bucket.score} accessible accessibilityLabel={`${bucket.score} stars: ${bucket.count} ratings`} style={styles.bucket}>
                  <View style={styles.barTrack}><View style={[styles.bar, { height: `${bucket.count / maxCount * 100}%` }]} /></View>
                  <Text style={styles.axis}>{bucket.score}</Text>
                </View>
              ))}
            </View>
          ) : <Text style={styles.muted}>No public ratings yet.</Text>}
          <Pressable accessibilityRole="button" accessibilityState={{ expanded }} onPress={() => setExpanded(!expanded)} style={styles.toggle}>
            <View style={styles.toggleCopy}>
              <Text style={styles.author}>{expanded ? 'Hide reviews' : `Show reviews (${community.reviewCount})`}</Text>
              {!expanded ? <Text style={styles.muted}>Written reviews may contain spoilers.</Text> : null}
            </View>
            {expanded ? <ChevronUp color={colors.textMuted} size={20} /> : <ChevronDown color={colors.textMuted} size={20} />}
          </Pressable>
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
              ) : <Text style={styles.muted}>No written reviews yet. Be the first to share yours.</Text>}
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
  summary: { gap: spacing.xs },
  score: { ...typography.heading, color: colors.text },
  muted: { ...typography.meta, color: colors.textSubtle },
  histogram: { flexDirection: 'row', gap: spacing.xs },
  bucket: { flex: 1, gap: spacing.xs, alignItems: 'center' },
  barTrack: { height: 64, width: '100%', justifyContent: 'flex-end', backgroundColor: colors.panelSoft, borderRadius: radii.xs, overflow: 'hidden' },
  bar: { width: '100%', backgroundColor: colors.rating, borderRadius: radii.xs },
  axis: { color: colors.textSubtle, fontSize: 10 },
  toggle: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  toggleCopy: { flex: 1, gap: spacing.xs },
  rail: { gap: spacing.md, alignItems: 'stretch' },
  card: { flex: 1, padding: spacing.md, gap: spacing.sm, backgroundColor: colors.panelElevated, borderWidth: 1, borderColor: colors.border, borderRadius: radii.lg },
  reviewHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  author: { ...typography.body, color: colors.text, fontWeight: '700', flex: 1 },
  body: { ...typography.body, color: colors.textMuted },
  report: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
});
