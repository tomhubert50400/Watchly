import { PropsWithChildren, ReactNode, RefObject, useLayoutEffect, useRef } from 'react';
import { useHeaderHeight } from '@react-navigation/elements';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import {
  KeyboardAvoidingView,
  GestureResponderEvent,
  LayoutChangeEvent,
  LayoutRectangle,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeHeaderTitle } from '../components/NativeHeaderTitle';
import { ScreenReveal } from '../components/ScreenReveal';
import { ScreenTopFade } from '../components/ScreenTopFade';
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
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
  trashHeader?: ReactNode;
  background?: ReactNode;
  footer?: ReactNode;
  isRefreshing?: boolean;
  onRefresh?: () => void;
  onContentSizeChange?: (width: number, height: number) => void;
  onLayout?: (event: LayoutChangeEvent) => void;
  onScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  overlay?: ReactNode;
  scrollRef?: RefObject<ScrollView | null>;
  scrollEnabled?: boolean;
  headerFade?: boolean;
}>;

type WatchlistPosterGridProps = {
  items: WatchlistDisplayItem[];
  dropTargetId?: string | null;
  reordering?: boolean;
  onItemLayout?: (item: WatchlistDisplayItem, layout: LayoutRectangle) => void;
  movingItemId?: string | null;
  onMove?: (item: WatchlistDisplayItem, event: GestureResponderEvent) => void;
  onMoveCancel?: (item: WatchlistDisplayItem) => void;
  onMoveEnd?: (item: WatchlistDisplayItem, event: GestureResponderEvent) => void;
  onMoveStart?: (
    item: WatchlistDisplayItem,
    event: GestureResponderEvent,
    geometry: { gripX: number; gripY: number; width: number },
  ) => void;
  onOpen: (item: WatchlistDisplayItem) => void;
};

type WatchlistSectionProps = PropsWithChildren<{ delay?: number }>;

export function WatchlistPage({
  title,
  subtitle,
  actions,
  trashHeader,
  background,
  children,
  footer,
  isRefreshing = false,
  onContentSizeChange,
  onLayout,
  onRefresh,
  onScroll,
  overlay,
  scrollRef: providedScrollRef,
  scrollEnabled = true,
  headerFade = title !== undefined,
}: WatchlistPageProps) {
  const internalScrollRef = useRef<ScrollView>(null);
  const scrollRef = providedScrollRef ?? internalScrollRef;
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const headerHeight = useHeaderHeight();
  const topInset = title !== undefined ? headerHeight : 0;
  const visibility = useFocusedFieldVisibility(scrollRef, topInset);
  useLayoutEffect(() => {
    if (title === undefined) return;
    navigation.setOptions({
      headerTitle: () => <NativeHeaderTitle title={title} subtitle={subtitle} />,
      headerRight: () => actions,
      header: trashHeader ? () => <View style={{ height: headerHeight }}>{trashHeader}</View> : undefined,
    });
  }, [actions, headerHeight, navigation, subtitle, title, trashHeader]);
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.keyboardAvoider}
    >
      {background ? <View pointerEvents="none" style={styles.background}>{background}</View> : null}
      <ScreenTopFade enabled={headerFade && insets.top > 0} topInset={insets.top}>
        <ScrollView
          ref={scrollRef}
          automaticallyAdjustKeyboardInsets={false}
          automaticallyAdjustContentInsets={false}
          contentInsetAdjustmentBehavior="never"
          contentContainerStyle={[styles.page, background ? styles.pageWithBackground : null, { paddingTop: topInset + spacing.xl, paddingBottom: (title !== undefined ? insets.bottom : 0) + spacing.xxxl }]}
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          keyboardShouldPersistTaps="handled"
          onBlur={visibility.onBlur}
          onContentSizeChange={(width, height) => {
            visibility.onContentSizeChange();
            onContentSizeChange?.(width, height);
          }}
          onFocus={visibility.onFocus}
          onLayout={(event) => {
            visibility.onLayout();
            onLayout?.(event);
          }}
          onScroll={(event) => {
            visibility.onScroll(event);
            onScroll?.(event);
          }}
          scrollEnabled={scrollEnabled}
          scrollEventThrottle={16}
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
      </ScreenTopFade>
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
  dropTargetId,
  reordering = false,
  onItemLayout,
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
        {items.map((item, index) => {
        const title = item.title?.trim() || 'Title unavailable';

        return (
          <Pressable
            accessibilityLabel={reordering ? `Move ${title}, position ${index + 1}` : `Open ${title}`}
            accessibilityHint={reordering ? 'Hold, then drag to another position.' : undefined}
            accessibilityRole="button"
            delayLongPress={350}
            key={item.id}
            onLayout={onItemLayout ? (event) => onItemLayout(item, event.nativeEvent.layout) : undefined}
            onLongPress={(event) => {
              if (!onMoveStart) return;
              longPressedItemRef.current = item.id;
              onMoveStart(item, event, {
                gripX: Math.max(0, Math.min(itemWidth, event.nativeEvent.locationX)),
                gripY: Math.max(0, Math.min(itemWidth * 1.5, event.nativeEvent.locationY)),
                width: itemWidth,
              });
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
              dropTargetId === item.id ? styles.dropTarget : null,
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
  background: {
    ...StyleSheet.absoluteFillObject,
  },
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
  dropTarget: {
    backgroundColor: colors.panelElevated,
    outlineColor: colors.accent,
    outlineWidth: 2,
    borderRadius: radii.md,
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
  pageWithBackground: {
    backgroundColor: 'transparent',
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
