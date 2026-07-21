import { useLayoutEffect } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ChevronRight } from 'lucide-react-native';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MediaHero } from '../components/MediaHero';
import { StarRatingDisplay } from '../components/StarRatingDisplay';
import { colors, spacing, typography } from '../design/tokens';
import { RootStackParamList } from '../navigation/types';

type ReviewDetailScreenProps = NativeStackScreenProps<RootStackParamList, 'ReviewDetail'>;

export function ReviewDetailScreen({ navigation, route }: ReviewDetailScreenProps) {
  const review = route.params;

  useLayoutEffect(() => {
    navigation.setOptions({
      headerStyle: { backgroundColor: 'transparent' },
      headerTintColor: colors.text,
      headerTitle: '',
      headerTransparent: true,
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
        <Pressable
          accessibilityLabel={`Open ${review.contentTitle}`}
          accessibilityRole="button"
          onPress={openContent}
          style={({ pressed }) => (pressed ? styles.heroPressed : null)}
        >
          <MediaHero
            backdropUrl={review.contentImageUrl}
            eyebrow={review.contentSubtitle}
            posterAccessibilityLabel={`${review.contentTitle} artwork`}
            posterUrl={review.contentImageUrl}
            title={review.contentTitle}
          >
            <View style={styles.openRow}>
              <Text style={styles.openLabel}>Open content</Text>
              <ChevronRight color={colors.accentText} size={16} strokeWidth={2.5} />
            </View>
          </MediaHero>
        </Pressable>

        <View style={styles.reviewSection}>
          <View style={styles.authorRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{getInitial(review.authorDisplayName)}</Text>
            </View>
            <View style={styles.authorCopy}>
              <Text style={styles.reviewLabel}>Review by</Text>
              <Text style={styles.authorName}>{review.authorDisplayName}</Text>
              <Text style={styles.date}>{formatDate(review.updatedAt)}</Text>
            </View>
          </View>

          {review.rating !== null ? (
            <View style={styles.ratingRow}>
              <StarRatingDisplay rating={review.rating} showValue size={19} />
            </View>
          ) : null}

          <View style={styles.reviewCopy}>
            <Text selectable style={styles.reviewBody}>{review.body}</Text>
          </View>
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
    marginTop: 2,
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
    backgroundColor: colors.accentSoft,
    borderColor: colors.accentBorder,
    borderRadius: 24,
    borderWidth: 1,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  avatarText: {
    color: colors.accentText,
    fontSize: 19,
    fontWeight: '900',
  },
  content: {
    flexGrow: 1,
    paddingBottom: spacing.xxxl,
  },
  date: {
    ...typography.meta,
    color: colors.textSubtle,
    marginTop: 2,
  },
  heroPressed: {
    opacity: 0.82,
  },
  openLabel: {
    ...typography.meta,
    color: colors.accentText,
    textTransform: 'uppercase',
  },
  openRow: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    flexDirection: 'row',
    gap: 2,
    marginTop: spacing.sm,
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
  reviewLabel: {
    ...typography.eyebrow,
    color: colors.accentText,
  },
  reviewSection: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
  },
  safeArea: {
    backgroundColor: colors.background,
    flex: 1,
  },
});
