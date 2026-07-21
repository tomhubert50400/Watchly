import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MediaPoster } from '../components/MediaPoster';
import { colors, radii, shadows, spacing, typography } from '../design/tokens';
import type { HomeFeedItem } from './homeData';

type SocialActivityRailProps = {
  items: HomeFeedItem[];
  onOpen: (item: HomeFeedItem) => void;
};

export function SocialActivityRail({ items, onOpen }: SocialActivityRailProps) {
  return (
    <ScrollView
      contentContainerStyle={styles.rail}
      horizontal
      nestedScrollEnabled
      showsHorizontalScrollIndicator={false}
    >
      {items.map((item) => (
        <Pressable
          accessibilityLabel={`Read review of ${item.contentTitle}, by ${item.authorDisplayName ?? 'a profile you follow'}`}
          accessibilityRole="button"
          key={item.id}
          onPress={() => onOpen(item)}
          style={({ pressed }) => [styles.card, pressed ? styles.pressed : null]}
        >
          <View style={styles.authorRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{getInitial(item.authorDisplayName)}</Text>
            </View>
            <View style={styles.authorCopy}>
              <Text numberOfLines={1} style={styles.authorName}>
                {item.authorDisplayName ?? 'Profile you follow'}
              </Text>
              <Text style={styles.date}>{formatDate(item.updatedAt)}</Text>
            </View>
          </View>
          <View style={styles.mediaRow}>
            <MediaPoster
              accessibilityLabel={`${item.contentTitle} poster`}
              posterUrl={item.contentImageUrl}
              style={styles.poster}
            />
            <View style={styles.reviewCopy}>
              <Text numberOfLines={1} style={styles.contentTitle}>{item.contentTitle}</Text>
              <Text numberOfLines={4} style={styles.body}>{item.body}</Text>
            </View>
          </View>
        </Pressable>
      ))}
    </ScrollView>
  );
}

function getInitial(displayName: string | null) {
  return displayName?.trim().slice(0, 1).toUpperCase() || '?';
}

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

const styles = StyleSheet.create({
  authorCopy: {
    flex: 1,
    minWidth: 0,
  },
  authorName: {
    ...typography.meta,
    color: colors.text,
  },
  authorRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  avatar: {
    alignItems: 'center',
    backgroundColor: colors.accentSoft,
    borderColor: colors.accentBorder,
    borderRadius: 20,
    borderWidth: 1,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  avatarText: {
    color: colors.accentText,
    fontSize: 16,
    fontWeight: '900',
  },
  body: {
    ...typography.body,
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
    marginTop: spacing.xs,
  },
  card: {
    ...shadows.panel,
    backgroundColor: colors.panelElevated,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.md,
    width: 310,
  },
  contentTitle: {
    ...typography.title,
    color: colors.text,
    fontSize: 16,
  },
  date: {
    ...typography.meta,
    color: colors.textSubtle,
  },
  mediaRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  poster: {
    height: 112,
    width: 74,
  },
  pressed: {
    opacity: 0.8,
    transform: [{ scale: 0.99 }],
  },
  rail: {
    gap: spacing.md,
    paddingRight: spacing.xl,
  },
  reviewCopy: {
    flex: 1,
    minWidth: 0,
  },
});
