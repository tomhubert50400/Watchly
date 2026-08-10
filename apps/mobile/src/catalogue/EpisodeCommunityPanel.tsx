import { Flag } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { ReportTarget } from '../api/reports';
import { EpisodeCommunityResponse, getEpisodeCommunity } from '../api/reviews';
import { useAuthSession } from '../auth/AuthSessionContext';
import { useCachedResource } from '../cache/useCachedResource';
import { StarRatingDisplay } from '../components/StarRatingDisplay';
import { UserAvatar } from '../components/UserAvatar';
import { colors, radii, spacing, touchTargets, typography } from '../design/tokens';
import { ReportSheet } from '../reports/ReportSheet';

type EpisodeCommunityPanelProps = {
  episodeNumber: number;
  seasonNumber: number;
  seriesTmdbId: number;
};

export function EpisodeCommunityPanel({
  episodeNumber,
  seasonNumber,
  seriesTmdbId,
}: EpisodeCommunityPanelProps) {
  const {
    currentUser,
    firebaseIdToken,
    getFirebaseIdToken,
    trackingRevision,
  } = useAuthSession();
  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null);
  const loadCommunity = useCallback(async () => {
    const token = firebaseIdToken ? await getFirebaseIdToken() : null;

    return getEpisodeCommunity(token, seriesTmdbId, seasonNumber, episodeNumber);
  }, [episodeNumber, firebaseIdToken, getFirebaseIdToken, seasonNumber, seriesTmdbId]);
  const resource = useCachedResource<EpisodeCommunityResponse>({
    key: [
      'watchly',
      'episode-community',
      currentUser?.id ?? 'public',
      seriesTmdbId,
      seasonNumber,
      episodeNumber,
      trackingRevision,
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
        onReport={(review) => setReportTarget({
          id: review.id,
          label: `Review by ${review.author.displayName?.trim() || 'Watchly member'}`,
          type: 'episodeReview',
        })}
        viewerUserId={currentUser?.id ?? null}
      />
      <ReportSheet onClose={() => setReportTarget(null)} target={reportTarget} />
    </View>
  );
}

function CommunityContent({
  community,
  onReport,
  viewerUserId,
}: {
  community: EpisodeCommunityResponse;
  onReport: (review: EpisodeCommunityResponse['reviews'][number]) => void;
  viewerUserId: string | null;
}) {
  const hasRatings = community.averageScore !== null && community.ratingCount > 0;

  if (!hasRatings && community.reviews.length === 0) {
    return <Text style={styles.status}>No public ratings or reviews yet.</Text>;
  }

  return (
    <View>
      {hasRatings ? (
        <View style={styles.summaryRow}>
          <StarRatingDisplay rating={community.averageScore!} showValue size={16} />
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
                <StarRatingDisplay rating={review.score} showValue size={13} />
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
              <Text numberOfLines={4} style={styles.reviewBody}>{review.body}</Text>
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
  return `${count} ${count === 1 ? 'rating' : 'ratings'}`;
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
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: spacing.md,
    paddingVertical: spacing.xl,
  },
  ratingCount: {
    ...typography.meta,
    color: colors.textSubtle,
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
  sectionTitle: {
    ...typography.title,
    color: colors.text,
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
});
