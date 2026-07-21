import { useLayoutEffect } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ChevronRight } from 'lucide-react-native';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Chip } from '../components/Chip';
import { MediaPoster } from '../components/MediaPoster';
import { StarRatingDisplay } from '../components/StarRatingDisplay';
import { colors, radii, spacing, typography } from '../design/tokens';
import { RootStackParamList } from '../navigation/types';

type ReviewDetailScreenProps = NativeStackScreenProps<RootStackParamList, 'ReviewDetail'>;

export function ReviewDetailScreen({ navigation, route }: ReviewDetailScreenProps) {
  const review = route.params;

  useLayoutEffect(() => {
    navigation.setOptions({
      headerStyle: { backgroundColor: colors.background },
      headerTintColor: colors.text,
      headerTitle: 'Review',
      headerTransparent: false,
    });
  }, [navigation]);

  function openContent() {
    if (review.target.contentType === 'movie') {
      navigation.navigate('FilmDetail', {
        title: review.contentTitle,
        tmdbId: review.target.tmdbId,
      });
      return;
    }

    navigation.navigate('EpisodeDetail', {
      episodeNumber: review.target.episodeNumber,
      seasonNumber: review.target.seasonNumber,
      seriesTitle: review.target.seriesTitle,
      title: review.contentTitle,
      tmdbId: review.target.seriesTmdbId,
    });
  }

  return (
    <SafeAreaView edges={[]} style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="never"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.authorRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{getInitial(review.authorDisplayName)}</Text>
          </View>
          <View style={styles.authorCopy}>
            <Text numberOfLines={2} style={styles.authorName}>{review.authorDisplayName}</Text>
            <Text style={styles.date}>{formatDate(review.updatedAt)}</Text>
          </View>
          <Chip label="Review" tone="neutral" />
        </View>

        <Pressable
          accessibilityLabel={`Open ${review.contentTitle}`}
          accessibilityRole="button"
          onPress={openContent}
          style={({ pressed }) => [styles.mediaRow, pressed ? styles.mediaRowPressed : null]}
        >
          <MediaPoster
            accessibilityLabel={`${review.contentTitle} artwork`}
            posterUrl={review.contentImageUrl}
            style={styles.poster}
          />
          <View style={styles.mediaCopy}>
            <Text style={styles.mediaMeta}>{review.contentSubtitle}</Text>
            <Text numberOfLines={3} style={styles.mediaTitle}>{review.contentTitle}</Text>
            <Text style={styles.openLabel}>Open content</Text>
          </View>
          <ChevronRight color={colors.accentText} size={20} strokeWidth={2.25} />
        </Pressable>

        {review.rating !== null ? (
          <View style={styles.ratingRow}>
            <StarRatingDisplay rating={review.rating} showValue size={19} />
          </View>
        ) : null}

        <View style={styles.reviewCopy}>
          <Text selectable style={styles.reviewBody}>{review.body}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function getInitial(displayName: string) {
  return displayName.trim().slice(0, 1).toUpperCase() || '?';
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
}

const styles = StyleSheet.create({
  authorCopy: {
    flex: 1,
    minWidth: 0,
  },
  authorName: {
    ...typography.title,
    color: colors.text,
  },
  authorRow: {
    alignItems: 'center',
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: spacing.md,
    paddingBottom: spacing.lg,
  },
  avatar: {
    alignItems: 'center',
    backgroundColor: colors.panelSoft,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  avatarText: {
    color: colors.accent,
    fontSize: 21,
    fontWeight: '900',
    letterSpacing: 0,
  },
  content: {
    flexGrow: 1,
    paddingBottom: spacing.xxxl,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
  },
  date: {
    ...typography.meta,
    color: colors.textSubtle,
    marginTop: 2,
  },
  mediaCopy: {
    flex: 1,
    justifyContent: 'center',
    minWidth: 0,
  },
  mediaMeta: {
    ...typography.meta,
    color: colors.textMuted,
    marginBottom: spacing.xs,
    textTransform: 'uppercase',
  },
  mediaRow: {
    alignItems: 'center',
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: spacing.md,
    paddingVertical: spacing.lg,
  },
  mediaRowPressed: {
    opacity: 0.72,
  },
  mediaTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.2,
    lineHeight: 23,
  },
  openLabel: {
    ...typography.meta,
    color: colors.accentText,
    marginTop: spacing.xs,
    textTransform: 'uppercase',
  },
  poster: {
    height: 102,
    width: 68,
  },
  ratingRow: {
    marginTop: spacing.lg,
  },
  reviewBody: {
    color: colors.text,
    fontSize: 19,
    letterSpacing: -0.1,
    lineHeight: 30,
  },
  reviewCopy: {
    borderLeftColor: colors.borderStrong,
    borderLeftWidth: 2,
    marginTop: spacing.lg,
    paddingLeft: spacing.md,
  },
  safeArea: {
    backgroundColor: colors.background,
    flex: 1,
  },
});
