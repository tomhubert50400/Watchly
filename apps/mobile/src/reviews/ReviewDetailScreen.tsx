import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Chip } from '../components/Chip';
import { MediaPoster } from '../components/MediaPoster';
import { Screen } from '../components/Screen';
import { StarRatingDisplay } from '../components/StarRatingDisplay';
import { colors, radii, shadows, spacing, typography } from '../design/tokens';
import { RootStackParamList } from '../navigation/types';

type ReviewDetailScreenProps = NativeStackScreenProps<RootStackParamList, 'ReviewDetail'>;

export function ReviewDetailScreen({ navigation, route }: ReviewDetailScreenProps) {
  const review = route.params;

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
    <Screen eyebrow="Review" title={review.authorDisplayName}>
      <View style={styles.metaRow}>
        <Chip label="Review" tone="neutral" />
        <Text style={styles.date}>{formatDate(review.updatedAt)}</Text>
      </View>

      <Pressable
        accessibilityLabel={`Open ${review.contentTitle}`}
        accessibilityRole="button"
        onPress={openContent}
        style={({ pressed }) => [styles.contentCard, pressed ? styles.pressed : null]}
      >
        <MediaPoster
          accessibilityLabel={`${review.contentTitle} artwork`}
          posterUrl={review.contentImageUrl}
          style={styles.poster}
        />
        <View style={styles.contentCopy}>
          <Text style={styles.contentMeta}>{review.contentSubtitle}</Text>
          <Text style={styles.contentTitle}>{review.contentTitle}</Text>
          <Text style={styles.contentAction}>Open content</Text>
        </View>
      </Pressable>

      <View style={styles.reviewCard}>
        {review.rating !== null ? (
          <StarRatingDisplay rating={review.rating} showValue size={19} />
        ) : null}
        <Text selectable style={styles.reviewBody}>{review.body}</Text>
      </View>
    </Screen>
  );
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
}

const styles = StyleSheet.create({
  contentAction: {
    ...typography.meta,
    color: colors.accentText,
    marginTop: spacing.xs,
  },
  contentCard: {
    alignItems: 'center',
    backgroundColor: colors.panelSoft,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
  },
  contentCopy: {
    flex: 1,
    minWidth: 0,
  },
  contentMeta: {
    ...typography.meta,
    color: colors.textSubtle,
  },
  contentTitle: {
    ...typography.title,
    color: colors.text,
    marginTop: 2,
  },
  date: {
    ...typography.meta,
    color: colors.textSubtle,
  },
  metaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  poster: {
    height: 84,
    width: 56,
  },
  pressed: {
    opacity: 0.78,
  },
  reviewBody: {
    color: colors.text,
    fontSize: 18,
    lineHeight: 29,
  },
  reviewCard: {
    ...shadows.panel,
    backgroundColor: colors.panelElevated,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    gap: spacing.lg,
    padding: spacing.lg,
  },
});
