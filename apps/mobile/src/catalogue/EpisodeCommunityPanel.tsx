import { useCallback } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { EpisodeCommunityResponse, getEpisodeCommunity } from '../api/reviews';
import { useAuthSession } from '../auth/AuthSessionContext';
import { useCachedResource } from '../cache/useCachedResource';
import { StarRatingDisplay } from '../components/StarRatingDisplay';
import { colors, radii, spacing, touchTargets, typography } from '../design/tokens';

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

  return (
    <View style={styles.panel}>
      <Text style={styles.sectionTitle}>Ratings & reviews</Text>
      {!community && resource.isInitialLoading ? (
        <Text style={styles.status}>Loading community opinions…</Text>
      ) : !community && resource.error ? (
        <View style={styles.errorRow}>
          <Text style={styles.errorText}>Could not load ratings and reviews.</Text>
          <Pressable
            accessibilityRole="button"
            onPress={resource.retry}
            style={({ pressed }) => [styles.retryButton, pressed && styles.retryButtonPressed]}
          >
            <Text style={styles.retryLabel}>Retry</Text>
          </Pressable>
        </View>
      ) : community ? (
        <CommunityContent community={community} />
      ) : null}
    </View>
  );
}

function CommunityContent({ community }: { community: EpisodeCommunityResponse }) {
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
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{getAuthorInitial(review.author.displayName)}</Text>
                </View>
                <Text numberOfLines={1} style={styles.author}>
                  {review.author.displayName ?? 'Unnamed profile'}
                </Text>
                <StarRatingDisplay rating={review.score} showValue size={13} />
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

function getAuthorInitial(displayName: string | null) {
  return (displayName ?? '?').trim().slice(0, 1).toUpperCase() || '?';
}

const styles = StyleSheet.create({
  author: {
    color: colors.text,
    flex: 1,
    fontSize: 14,
    fontWeight: '800',
    minWidth: 0,
  },
  avatar: {
    alignItems: 'center',
    backgroundColor: colors.panelSoft,
    borderRadius: radii.sm,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  avatarText: {
    color: colors.accentText,
    fontSize: 13,
    fontWeight: '900',
  },
  errorRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  errorText: {
    ...typography.meta,
    color: colors.textSubtle,
    flex: 1,
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
  retryButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: touchTargets.min,
    paddingHorizontal: spacing.sm,
  },
  retryButtonPressed: {
    opacity: 0.76,
    transform: [{ scale: 0.98 }],
  },
  retryLabel: {
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
