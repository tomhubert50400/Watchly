import { Flag, ShieldAlert, Star } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { ReportTarget } from '../api/reports';
import { EpisodeCommunityResponse, getEpisodeCommunity } from '../api/reviews';
import { useAuthSession } from '../auth/AuthSessionContext';
import { useCachedResource } from '../cache/useCachedResource';
import { UserAvatar } from '../components/UserAvatar';
import { colors, radii, spacing, touchTargets, typography } from '../design/tokens';
import { ReportSheet } from '../reports/ReportSheet';
import { useUserDataRevision } from '../sync/userDataEvents';

type EpisodeCommunityPanelProps = {
  episodeNumber: number;
  seasonNumber: number;
  seriesTmdbId: number;
  spoilerProtected?: boolean;
};

export function EpisodeCommunityPanel({
  episodeNumber,
  seasonNumber,
  seriesTmdbId,
  spoilerProtected = false,
}: EpisodeCommunityPanelProps) {
  const { currentUser, firebaseIdToken, getFirebaseIdToken } = useAuthSession();
  const opinionRevision = useUserDataRevision('opinions');
  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null);
  const loadCommunity = useCallback(async () => {
    void opinionRevision;
    const token = firebaseIdToken ? await getFirebaseIdToken() : null;

    return getEpisodeCommunity(token, seriesTmdbId, seasonNumber, episodeNumber);
  }, [episodeNumber, firebaseIdToken, getFirebaseIdToken, opinionRevision, seasonNumber, seriesTmdbId]);
  const resource = useCachedResource<EpisodeCommunityResponse>({
    key: [
      'watchly',
      'episode-community',
      currentUser?.id ?? 'public',
      seriesTmdbId,
      seasonNumber,
      episodeNumber,
    ].join(':'),
    load: loadCommunity,
  });
  const community = resource.data;

  if (!community) {
    return null;
  }

  return (
    <View style={styles.panel}>
      <Text style={styles.sectionTitle}>Ratings & reviews</Text>
      <CommunityContent
        community={community}
        key={`${seriesTmdbId}:${seasonNumber}:${episodeNumber}:${spoilerProtected}`}
        onReport={(review) => setReportTarget({
          id: review.id,
          label: `Review by ${review.author.displayName?.trim() || 'Watchly member'}`,
          type: 'episodeReview',
        })}
        spoilerProtected={spoilerProtected}
        viewerUserId={currentUser?.id ?? null}
      />
      <ReportSheet onClose={() => setReportTarget(null)} target={reportTarget} />
    </View>
  );
}

function CommunityContent({
  community,
  onReport,
  spoilerProtected,
  viewerUserId,
}: {
  community: EpisodeCommunityResponse;
  onReport: (review: EpisodeCommunityResponse['reviews'][number]) => void;
  spoilerProtected: boolean;
  viewerUserId: string | null;
}) {
  const hasRatings = community.averageScore !== null && community.ratingCount > 0;
  const [revealedReviewIds, setRevealedReviewIds] = useState<Set<string>>(() => new Set());

  if (!hasRatings && community.reviews.length === 0) {
    return <Text style={styles.status}>No public ratings or reviews yet.</Text>;
  }

  return (
    <View>
      {hasRatings ? (
        <View style={styles.summaryRow}>
          <Text style={styles.summaryScore}>{community.averageScore!.toFixed(1)}/5</Text>
          <Text style={styles.summaryDot}>·</Text>
          <Text style={styles.ratingCount}>{formatRatingCount(community.ratingCount)}</Text>
        </View>
      ) : null}
      {community.reviews.length > 0 ? (
        <View style={styles.reviews}>
          {community.reviews.map((review, index) => (
            <View key={review.id} style={[styles.review, index > 0 && styles.reviewBorder]}>
              <View style={styles.reviewHeader}>
                <UserAvatar
                  avatarUrl={review.author.avatarUrl}
                  displayName={review.author.displayName}
                  size={32}
                />
                <Text numberOfLines={1} style={styles.author}>
                  {review.author.displayName ?? 'Unnamed profile'}
                </Text>
                <Star color={colors.rating} fill={colors.rating} size={17} strokeWidth={2} />
                <Text style={styles.reviewScore}>{review.score.toFixed(1)}</Text>
                {viewerUserId && viewerUserId !== review.author.id ? (
                  <Pressable
                    accessibilityLabel={`Report ${review.author.displayName?.trim() || 'Watchly member'}'s review`}
                    accessibilityRole="button"
                    hitSlop={4}
                    onPress={() => onReport(review)}
                    style={({ pressed }) => [styles.reportButton, pressed ? styles.reportButtonPressed : null]}
                  >
                    <Flag color={colors.textMuted} size={17} strokeWidth={2} />
                  </Pressable>
                ) : null}
              </View>
              {spoilerProtected && !revealedReviewIds.has(review.id) ? (
                <View style={styles.spoilerReview}>
                  <View style={styles.spoilerCopy}>
                    <ShieldAlert color={colors.textSubtle} size={17} strokeWidth={2.2} />
                    <Text style={styles.spoilerLabel}>Review contains spoilers</Text>
                  </View>
                  <Pressable
                    accessibilityLabel={`Reveal ${review.author.displayName?.trim() || 'member'} review`}
                    accessibilityRole="button"
                    onPress={() => setRevealedReviewIds((current) => new Set(current).add(review.id))}
                    style={({ pressed }) => [styles.revealButton, pressed && styles.reportButtonPressed]}
                  >
                    <Text style={styles.revealLabel}>Reveal review</Text>
                  </Pressable>
                </View>
              ) : (
                <Text numberOfLines={4} style={styles.reviewBody}>{review.body}</Text>
              )}
            </View>
          ))}
        </View>
      ) : (
        <Text style={styles.status}>No written reviews yet.</Text>
      )}
    </View>
  );
}

function formatRatingCount(count: number) {
  const formatted = count >= 1_000
    ? `${(count / 1_000).toFixed(count >= 10_000 ? 0 : 1).replace('.0', '')}K`
    : String(count);

  return `${formatted} ${count === 1 ? 'rating' : 'ratings'}`;
}

const styles = StyleSheet.create({
  author: {
    color: colors.text,
    flex: 1,
    fontSize: 14,
    fontWeight: '800',
    minWidth: 0,
  },
  panel: {
    backgroundColor: colors.panelElevated,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    gap: spacing.md,
    marginTop: spacing.md,
    padding: spacing.lg,
  },
  ratingCount: {
    ...typography.body,
    color: colors.textMuted,
  },
  reportButton: {
    alignItems: 'center',
    borderRadius: radii.sm,
    height: touchTargets.min,
    justifyContent: 'center',
    marginVertical: -6,
    width: touchTargets.min,
  },
  reportButtonPressed: {
    opacity: 0.72,
  },
  revealButton: {
    alignItems: 'center',
    borderColor: colors.accentBorder,
    borderRadius: radii.sm,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: touchTargets.min,
    paddingHorizontal: spacing.md,
  },
  revealLabel: {
    color: colors.accentText,
    fontSize: 13,
    fontWeight: '800',
  },
  review: {
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  reviewBody: {
    ...typography.body,
    color: colors.textMuted,
  },
  reviewBorder: {
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  reviewHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  reviews: {
    marginBottom: -spacing.md,
    marginTop: spacing.sm,
  },
  spoilerCopy: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
  },
  spoilerLabel: {
    ...typography.meta,
    color: colors.textSubtle,
  },
  spoilerReview: {
    alignItems: 'center',
    backgroundColor: colors.panelSoft,
    borderRadius: radii.sm,
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
    padding: spacing.sm,
  },
  sectionTitle: {
    ...typography.eyebrow,
    color: colors.textMuted,
  },
  status: {
    ...typography.body,
    color: colors.textSubtle,
  },
  summaryRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  summaryDot: {
    color: colors.textSubtle,
    fontSize: 15,
  },
  summaryScore: {
    ...typography.body,
    color: colors.textMuted,
  },
  reviewScore: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '700',
  },
});
