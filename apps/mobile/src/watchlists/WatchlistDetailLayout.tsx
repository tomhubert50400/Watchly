import { PropsWithChildren, ReactNode, useRef } from 'react';
import {
  KeyboardAvoidingView,
  GestureResponderEvent,
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
import { ScreenReveal } from '../components/ScreenReveal';
import { useFocusedFieldVisibility } from '../components/useFocusedFieldVisibility';
import { MediaPoster } from '../components/MediaPoster';
import { colors, radii, spacing, typography } from '../design/tokens';

export type WatchlistDisplayItem = {
  contentType: 'movie' | 'series';
  id: string;
  posterUrl: string | null;
  sectionId?: string | null;
  tmdbId: number;
  title: string | null;
};

type WatchlistPageProps = PropsWithChildren<{
  footer?: ReactNode;
  isRefreshing?: boolean;
  onRefresh?: () => void;
  overlay?: ReactNode;
  scrollEnabled?: boolean;
}>;

type WatchlistPosterGridProps = {
  items: WatchlistDisplayItem[];
  movingItemId?: string | null;
  onMove?: (item: WatchlistDisplayItem, event: GestureResponderEvent) => void;
  onMoveCancel?: (item: WatchlistDisplayItem) => void;
  onMoveEnd?: (item: WatchlistDisplayItem, event: GestureResponderEvent) => void;
  onMoveStart?: (item: WatchlistDisplayItem, event: GestureResponderEvent) => void;
  onOpen: (item: WatchlistDisplayItem) => void;
};

type WatchlistSectionProps = PropsWithChildren<{ delay?: number }>;

export function WatchlistPage({
  children,
  footer,
  isRefreshing = false,
  onRefresh,
  overlay,
  scrollEnabled = true,
}: WatchlistPageProps) {
  const scrollRef = useRef<ScrollView>(null);
  const visibility = useFocusedFieldVisibility(scrollRef);
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.keyboardAvoider}
    >
      <ScrollView
        ref={scrollRef}
        {...visibility}
        automaticallyAdjustKeyboardInsets={false}
        contentContainerStyle={styles.page}
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        keyboardShouldPersistTaps="handled"
        scrollEnabled={scrollEnabled}
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
      {overlay}
      {footer ? (
        <SafeAreaView edges={['bottom']} style={styles.footer}>
          {footer}
        </SafeAreaView>
      ) : null}
    </KeyboardAvoidingView>
  );
}

export function WatchlistPosterGrid({
  items,
  movingItemId = null,
  onMove,
  onMoveCancel,
  onMoveEnd,
  onMoveStart,
  onOpen,
}: WatchlistPosterGridProps) {
  const { fontScale, width } = useWindowDimensions();
  const longPressedItemRef = useRef<string | null>(null);
  const availableWidth = Math.max(width - spacing.xl * 2, 0);
  const columnCount = resolveColumnCount(availableWidth, fontScale);
  const itemWidth = Math.floor(
    (availableWidth - spacing.sm * (columnCount - 1)) / columnCount,
  );

  return (
    <ScreenReveal delay={100} style={styles.grid}>
      {items.map((item) => {
        const title = item.title?.trim() || 'Title unavailable';

        return (
          <Pressable
            accessibilityLabel={`Open ${title}`}
            accessibilityRole="button"
            delayLongPress={350}
            key={item.id}
            onLongPress={(event) => {
              if (!onMoveStart) return;
              longPressedItemRef.current = item.id;
              onMoveStart(item, event);
            }}
            onPress={() => {
              if (longPressedItemRef.current !== item.id) onOpen(item);
            }}
            onTouchCancel={() => {
              if (longPressedItemRef.current === item.id) {
                onMoveCancel?.(item);
                setTimeout(() => {
                  if (longPressedItemRef.current === item.id) longPressedItemRef.current = null;
                }, 0);
              }
            }}
            onTouchEnd={(event) => {
              if (longPressedItemRef.current === item.id) {
                onMoveEnd?.(item, event);
                setTimeout(() => {
                  if (longPressedItemRef.current === item.id) longPressedItemRef.current = null;
                }, 0);
              }
            }}
            onTouchMove={(event) => {
              if (longPressedItemRef.current === item.id) onMove?.(item, event);
            }}
            pressRetentionOffset={{ bottom: 1000, left: 1000, right: 1000, top: 1000 }}
            style={({ pressed }) => [
              styles.tile,
              { width: itemWidth },
              movingItemId === item.id ? styles.moving : null,
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
    </ScreenReveal>
  );
}

export function WatchlistSection({ children, delay = 50 }: WatchlistSectionProps) {
  return <ScreenReveal delay={delay} style={styles.section}>{children}</ScreenReveal>;
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
  moving: {
    opacity: 0.45,
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
