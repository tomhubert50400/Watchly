import { PropsWithChildren, ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Pressable,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MediaPoster } from '../components/MediaPoster';
import { colors, radii, spacing, typography } from '../design/tokens';

export type WatchlistDisplayItem = {
  contentType: 'movie' | 'series';
  id: string;
  posterUrl: string | null;
  tmdbId: number;
  title: string | null;
};

type WatchlistPageProps = PropsWithChildren<{
  footer?: ReactNode;
  isRefreshing?: boolean;
  onRefresh?: () => void;
}>;

type WatchlistPosterGridProps = {
  items: WatchlistDisplayItem[];
  onOpen: (item: WatchlistDisplayItem) => void;
};

type WatchlistSectionProps = PropsWithChildren;

export function WatchlistPage({
  children,
  footer,
  isRefreshing = false,
  onRefresh,
}: WatchlistPageProps) {
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.keyboardAvoider}
    >
      <ScrollView
        automaticallyAdjustKeyboardInsets
        contentContainerStyle={styles.page}
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        keyboardShouldPersistTaps="handled"
        refreshControl={onRefresh ? (
          <RefreshControl
            onRefresh={onRefresh}
            refreshing={isRefreshing}
            tintColor={colors.accent}
          />
        ) : undefined}
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
      {footer ? (
        <SafeAreaView edges={['bottom']} style={styles.footer}>
          {footer}
        </SafeAreaView>
      ) : null}
    </KeyboardAvoidingView>
  );
}

export function WatchlistPosterGrid({ items, onOpen }: WatchlistPosterGridProps) {
  const { fontScale, width } = useWindowDimensions();
  const availableWidth = Math.max(width - spacing.xl * 2, 0);
  const columnCount = resolveColumnCount(availableWidth, fontScale);
  const itemWidth = Math.floor(
    (availableWidth - spacing.sm * (columnCount - 1)) / columnCount,
  );

  return (
    <View style={styles.grid}>
      {items.map((item) => {
        const title = item.title?.trim() || 'Title unavailable';

        return (
          <Pressable
            accessibilityLabel={`Open ${title}`}
            accessibilityRole="button"
            key={item.id}
            onPress={() => onOpen(item)}
            style={({ pressed }) => [
              styles.tile,
              { width: itemWidth },
              pressed ? styles.pressed : null,
            ]}
          >
            <MediaPoster
              accessibilityLabel={`${title} poster`}
              posterUrl={item.posterUrl}
              style={[styles.poster, { width: itemWidth }]}
            />
            <Text numberOfLines={2} style={styles.itemTitle}>{title}</Text>
            <Text style={styles.itemMeta}>{item.contentType === 'movie' ? 'Film' : 'Series'}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function WatchlistSection({ children }: WatchlistSectionProps) {
  return <View style={styles.section}>{children}</View>;
}

function resolveColumnCount(availableWidth: number, fontScale: number) {
  if (fontScale >= 1.3 || availableWidth < 320) return 2;
  if (availableWidth < 560) return 3;
  if (availableWidth < 760) return 4;
  return 5;
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  itemMeta: {
    ...typography.meta,
    color: colors.textSubtle,
    marginTop: 2,
  },
  itemTitle: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 17,
    marginTop: spacing.xs,
  },
  footer: {
    backgroundColor: colors.background,
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
  },
  keyboardAvoider: {
    flex: 1,
  },
  page: {
    backgroundColor: colors.background,
    flexGrow: 1,
    gap: spacing.xl,
    paddingBottom: spacing.xxxl,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
  },
  poster: {
    aspectRatio: 2 / 3,
    borderRadius: radii.md,
  },
  pressed: {
    opacity: 0.76,
    transform: [{ scale: 0.99 }],
  },
  section: {
    gap: spacing.sm,
  },
  tile: {
    minWidth: 0,
  },
});
