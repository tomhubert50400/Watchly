import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Star, Settings } from 'lucide-react-native';
import { getEpisodeDetails, getMovieDetails } from '../api/catalogue';
import { getOwnProfileOpinions, ProfileOpinion } from '../api/profile';
import { useAuthSession } from '../auth/AuthSessionContext';
import { ProfileAuthCard } from '../auth/ProfileAuthCard';
import { Button } from '../components/Button';
import { Chip } from '../components/Chip';
import { EmptyState } from '../components/EmptyState';
import { IconButton } from '../components/IconButton';
import { LoadingState } from '../components/LoadingState';
import { MediaPoster } from '../components/MediaPoster';
import { Screen } from '../components/Screen';
import { colors, radii, shadows, spacing, typography } from '../design/tokens';
import { RootStackParamList } from '../navigation/types';
import { ProfileSummaryCard } from './ProfileSummaryCard';

type ProfileNavigation = NativeStackNavigationProp<RootStackParamList>;
type ProfileStats = {
  followersCount: number;
  postsCount: number;
  reviewsCount: number;
};
type HydratedProfileOpinion = ProfileOpinion & {
  contentImageUrl: string | null;
  contentSubtitle: string;
  contentTitle: string;
  seriesTitle: string | null;
};

export function ProfileScreen() {
  const navigation = useNavigation<ProfileNavigation>();
  const { currentUser, firebaseIdToken, trackingRevision } = useAuthSession();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [items, setItems] = useState<HydratedProfileOpinion[]>([]);
  const [profileStats, setProfileStats] = useState<ProfileStats | null>(null);
  const itemsLengthRef = useRef(0);

  useEffect(() => {
    itemsLengthRef.current = items.length;
  }, [items.length]);

  const loadOpinions = useCallback(async (showLoading = true) => {
    if (!firebaseIdToken) {
      setError(null);
      setItems([]);
      setProfileStats(null);
      return;
    }

    setError(null);
    const shouldShowBlockingLoader = showLoading && itemsLengthRef.current === 0;

    if (shouldShowBlockingLoader) {
      setIsLoading(true);
    } else if (!showLoading) {
      setIsRefreshing(true);
    }

    try {
      const response = await withTimeout(
        getOwnProfileOpinions(firebaseIdToken),
        PROFILE_LOAD_TIMEOUT_MS,
        'Could not load your opinions.',
      );
      const fallbackItems = response.items.map(getFallbackProfileOpinion);

      setProfileStats(response.stats);
      setItems(fallbackItems);
      if (shouldShowBlockingLoader) {
        setIsLoading(false);
      } else if (!showLoading) {
        setIsRefreshing(false);
      }

      const hydratedItems = await Promise.all(
        response.items.map((item) =>
          withTimeout(
            hydrateProfileOpinion(item),
            PROFILE_HYDRATION_TIMEOUT_MS,
            getFallbackProfileOpinion(item),
          ),
        ),
      );

      setItems(hydratedItems);
    } catch (loadError) {
      if (itemsLengthRef.current === 0) {
        setItems([]);
        setError(loadError instanceof Error ? loadError.message : 'Could not load your opinions.');
      }
    } finally {
      if (shouldShowBlockingLoader) {
        setIsLoading(false);
      } else if (!showLoading) {
        setIsRefreshing(false);
      }
    }
  }, [firebaseIdToken]);

  useEffect(() => {
    void loadOpinions();
  }, [loadOpinions, trackingRevision]);

  const refreshOpinions = useCallback(() => {
    void loadOpinions(false);
  }, [loadOpinions]);
  const openOpinion = useCallback(
    (item: HydratedProfileOpinion) => {
      if (item.content.contentType === 'movie') {
        navigation.navigate('FilmDetail', {
          title: item.contentTitle,
          tmdbId: item.content.tmdbId,
        });
        return;
      }

      navigation.navigate('EpisodeDetail', {
        episodeNumber: item.content.episodeNumber,
        seasonNumber: item.content.seasonNumber,
        seriesTitle: item.seriesTitle ?? `Series ${item.content.seriesTmdbId}`,
        title: item.contentTitle,
        tmdbId: item.content.seriesTmdbId,
      });
    },
    [navigation],
  );

  return (
    <Screen
      refreshControl={
        firebaseIdToken ? (
          <RefreshControl
            colors={[colors.accent]}
            onRefresh={refreshOpinions}
            refreshing={isRefreshing}
            tintColor={colors.accent}
          />
        ) : undefined
      }
      eyebrow={firebaseIdToken ? 'Your profile' : undefined}
      title={firebaseIdToken ? 'Film log' : ''}
      trailing={
        firebaseIdToken ? (
          <IconButton
            accessibilityLabel="Open settings"
            icon={<Settings color={colors.text} size={22} strokeWidth={2} />}
            onPress={() => navigation.navigate('Settings')}
          />
        ) : null
      }
    >
      {!firebaseIdToken ? (
        <ProfileAuthCard />
      ) : (
        <View style={styles.list}>
          <ProfileSummaryCard
            displayName={currentUser?.displayName ?? null}
            followersCount={profileStats?.followersCount ?? 0}
            postsCount={profileStats?.postsCount ?? items.length}
            reviewsCount={profileStats?.reviewsCount ?? getReviewCount(items)}
          />
          {isLoading ? (
            <LoadingState label="Loading your opinions" />
          ) : error ? (
            <EmptyState body={error} title="Opinions failed">
              <Button
                label="Retry"
                onPress={() => {
                  void loadOpinions();
                }}
              />
            </EmptyState>
          ) : items.length === 0 ? (
            <EmptyState
              body="Rate or review a film or episode, then it will appear here."
              title="No opinions yet"
            />
          ) : (
            items.map((item) => (
              <ProfileOpinionCard item={item} key={`${item.type}-${item.id}`} onPress={openOpinion} />
            ))
          )}
        </View>
      )}
    </Screen>
  );
}

const ProfileOpinionCard = memo(function ProfileOpinionCard({
  item,
  onPress,
}: {
  item: HydratedProfileOpinion;
  onPress: (item: HydratedProfileOpinion) => void;
}) {
  const isRating = item.type === 'movieRating' || item.type === 'episodeRating';
  const opinionLabel = isRating ? 'Rating' : 'Review';
  const contentTitle = item.content.contentType === 'episode'
    ? item.seriesTitle ?? `Series ${item.content.seriesTmdbId}`
    : item.contentTitle;
  const contentSubtitle = item.content.contentType === 'episode'
    ? `${formatEpisodeNumber(item.content.seasonNumber, item.content.episodeNumber)} - ${item.contentTitle}`
    : item.contentSubtitle;

  return (
    <Pressable
      accessibilityLabel={`Open ${item.contentTitle}`}
      accessibilityRole="button"
      onPress={() => onPress(item)}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
    >
      <View style={styles.opinionTopRow}>
        <MediaPoster
          accessibilityLabel={`${item.contentTitle} artwork`}
          posterUrl={item.contentImageUrl}
          style={styles.contentImage}
        />
        <View style={styles.contentCopy}>
          <View style={styles.opinionMetaRow}>
            <Chip label={opinionLabel} tone={isRating ? 'rating' : 'accent'} />
            <Text style={styles.date}>{formatDate(item.updatedAt)}</Text>
          </View>
          <Text numberOfLines={2} style={styles.contentTitle}>
            {contentTitle}
          </Text>
          <Text style={styles.contentSubtitle}>{contentSubtitle}</Text>
          <StarRating score={item.score} />
        </View>
      </View>
      {!isRating ? (
        <View style={styles.reviewBody}>
          <Text numberOfLines={4} style={styles.body}>
            {item.body}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
});

function StarRating({ score }: { score: number }) {
  return (
    <View accessibilityLabel={`${score}/5`} style={styles.starRow}>
      {Array.from({ length: 5 }, (_, index) => {
        const fillRatio = Math.max(0, Math.min(1, score - index));

        return (
          <View key={index} style={styles.starBox}>
            <Star color={colors.rating} fill="transparent" size={22} strokeWidth={2.2} />
            {fillRatio > 0 ? (
              <View style={[styles.starFillClip, { width: `${fillRatio * 100}%` }]}>
                <Star color={colors.rating} fill={colors.rating} size={22} strokeWidth={2.2} />
              </View>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

async function hydrateProfileOpinion(item: ProfileOpinion): Promise<HydratedProfileOpinion> {
  if (item.content.contentType === 'movie') {
    try {
      const response = await getMovieDetails(item.content.tmdbId);

      return {
        ...item,
        contentImageUrl: response.item.posterUrl,
        contentSubtitle: 'Movie',
        contentTitle: response.item.title,
        seriesTitle: null,
      };
    } catch {
      return {
        ...getFallbackProfileOpinion(item),
      };
    }
  }

  try {
    const response = await getEpisodeDetails(
      item.content.seriesTmdbId,
      item.content.seasonNumber,
      item.content.episodeNumber,
    );

    return {
      ...item,
      contentImageUrl: response.item.stillUrl,
      contentSubtitle: `S${item.content.seasonNumber} E${item.content.episodeNumber}`,
      contentTitle: response.item.title,
      seriesTitle: `Series ${item.content.seriesTmdbId}`,
    };
  } catch {
    return getFallbackProfileOpinion(item);
  }
}

function getFallbackProfileOpinion(item: ProfileOpinion): HydratedProfileOpinion {
  if (item.content.contentType === 'movie') {
    return {
      ...item,
      contentImageUrl: null,
      contentSubtitle: 'Movie',
      contentTitle: `Movie TMDB ${item.content.tmdbId}`,
      seriesTitle: null,
    };
  }

  return {
    ...item,
    contentImageUrl: null,
    contentSubtitle: `S${item.content.seasonNumber} E${item.content.episodeNumber}`,
    contentTitle: `Episode S${item.content.seasonNumber} E${item.content.episodeNumber}`,
    seriesTitle: `Series ${item.content.seriesTmdbId}`,
  };
}

function formatEpisodeNumber(seasonNumber: number, episodeNumber: number) {
  return `S${seasonNumber} E${episodeNumber}`;
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, fallback: T): Promise<T>;
function withTimeout<T>(promise: Promise<T>, timeoutMs: number, errorMessage: string): Promise<T>;
function withTimeout<T>(promise: Promise<T>, timeoutMs: number, fallbackOrMessage: T | string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout>;

  const timeout = new Promise<T>((resolve, reject) => {
    timeoutId = setTimeout(() => {
      if (typeof fallbackOrMessage === 'string') {
        reject(new Error(fallbackOrMessage));
        return;
      }

      resolve(fallbackOrMessage);
    }, timeoutMs);
  });

  return Promise.race([promise, timeout]).finally(() => {
    clearTimeout(timeoutId);
  });
}

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toLocaleDateString();
}

function getReviewCount(items: HydratedProfileOpinion[]) {
  return items.filter((item) => item.type === 'movieReview' || item.type === 'episodeReview').length;
}

const styles = StyleSheet.create({
  body: {
    ...typography.body,
    color: colors.textMuted,
  },
  card: {
    ...shadows.panel,
    backgroundColor: colors.panelElevated,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.lg,
  },
  cardPressed: {
    opacity: 0.78,
    transform: [{ scale: 0.99 }],
  },
  contentCopy: {
    flex: 1,
    justifyContent: 'center',
    minWidth: 0,
  },
  contentImage: {
    height: 116,
    width: 78,
  },
  contentSubtitle: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0,
    marginTop: spacing.xs,
    textTransform: 'uppercase',
  },
  contentTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 22,
  },
  date: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0,
  },
  list: {
    gap: spacing.md,
  },
  opinionMetaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'space-between',
  },
  opinionTopRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  reviewBody: {
    borderLeftColor: colors.borderStrong,
    borderLeftWidth: 2,
    paddingLeft: spacing.md,
  },
  starRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: spacing.md,
  },
  starBox: {
    height: 22,
    width: 22,
  },
  starFillClip: {
    bottom: 0,
    left: 0,
    overflow: 'hidden',
    position: 'absolute',
    top: 0,
  },
});

const PROFILE_HYDRATION_TIMEOUT_MS = 2500;
const PROFILE_LOAD_TIMEOUT_MS = 8000;
