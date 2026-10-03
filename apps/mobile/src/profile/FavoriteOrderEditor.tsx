import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, GestureResponderEvent, LayoutRectangle, Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import { MediaPoster } from '../components/MediaPoster';
import { colors, radii, spacing, typography } from '../design/tokens';
import { hapticSelection } from '../feedback/haptics';
import type { LibraryMediaItem } from '../library/useLibraryData';
import { WatchlistPage, WatchlistPosterGrid, type WatchlistDisplayItem } from '../watchlists/WatchlistDetailLayout';
import { resolveCarriedPosterTilt, resolveWatchlistAutoScrollDelta } from '../watchlists/watchlistSections';
import { moveFavorite, resolveFavoriteDropTarget } from './profileMediaModel';
import { useHydratedProfileMediaItems } from './useHydratedProfileMediaItems';

type MovingFavorite = {
  item: WatchlistDisplayItem;
  x: number; y: number; gripX: number; gripY: number; width: number;
};

export function FavoriteOrderEditor({ items, error, onClose, onChange, onRetry }: {
  items: LibraryMediaItem[];
  error: string | null;
  onClose: () => void;
  onChange: (items: LibraryMediaItem[]) => void;
  onRetry: () => void;
}) {
  const [draft, setDraft] = useState(items);
  const hydrated = useHydratedProfileMediaItems(draft);
  const posters = useMemo(() => hydrated.map((item) => ({ ...item, id: item.key })), [hydrated]);
  const [moving, setMoving] = useState<MovingFavorite | null>(null);
  const [target, setTarget] = useState<string | null>(null);
  const movingRef = useRef<MovingFavorite | null>(null);
  const dragScale = useRef(new Animated.Value(1)).current;
  const dragTilt = useRef(new Animated.Value(0)).current;
  const dragTiltValueRef = useRef(0);
  const dragTiltResetRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastMoveTimeRef = useRef(0);
  const scrollRef = useRef<ScrollView>(null);
  const gridRef = useRef<View>(null);
  const overlayRef = useRef<View>(null);
  const layouts = useRef(new Map<string, LayoutRectangle>());
  const gridOrigin = useRef({ x: 0, y: 0 });
  const gridBounds = useRef({ width: 0, height: 0 });
  const overlayOrigin = useRef({ x: 0, y: 0 });
  const viewport = useRef({ top: 0, bottom: 0, offset: 0, contentHeight: 0 });

  function findTarget(point: { x: number; y: number }) {
    if (point.y < viewport.current.top || point.y > viewport.current.bottom) return null;
    return resolveFavoriteDropTarget(
      { x: point.x - gridOrigin.current.x, y: point.y - gridOrigin.current.y },
      draft.flatMap((item) => {
        const rect = layouts.current.get(item.key);
        return rect ? [{ key: item.key, ...rect }] : [];
      }),
      gridBounds.current,
    );
  }

  function measure() {
    gridRef.current?.measureInWindow((x, y) => {
      gridOrigin.current = { x, y };
      if (movingRef.current) setTarget(findTarget(movingRef.current));
    });
    overlayRef.current?.measureInWindow((x, y) => { overlayOrigin.current = { x, y }; });
    scrollRef.current?.getNativeScrollRef()?.measureInWindow((_x, y, _width, height) => {
      viewport.current.top = y;
      viewport.current.bottom = y + height;
    });
  }

  useEffect(() => {
    if (!moving) return;
    let frame: number;
    const tick = () => {
      const point = movingRef.current;
      const metrics = viewport.current;
      if (point && metrics.bottom > metrics.top) {
        const delta = resolveWatchlistAutoScrollDelta(point.y, metrics.top, metrics.bottom);
        const maxOffset = Math.max(0, metrics.contentHeight - (metrics.bottom - metrics.top));
        const next = Math.max(0, Math.min(maxOffset, metrics.offset + delta));
        if (next !== metrics.offset) {
          metrics.offset = next;
          scrollRef.current?.scrollTo({ y: next, animated: false });
        }
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [moving?.item.id]);

  function stopMove() {
    resetDragAnimation();
    movingRef.current = null;
    setMoving(null);
    setTarget(null);
  }

  function updateMove(item: WatchlistDisplayItem, event: GestureResponderEvent) {
    if (movingRef.current?.item.id !== item.id) return;
    const next = { ...movingRef.current, x: event.nativeEvent.pageX, y: event.nativeEvent.pageY };
    const now = Date.now();
    const elapsedMs = Math.max(8, Math.min(64, now - lastMoveTimeRef.current));
    const horizontalVelocity = (next.x - movingRef.current.x) / elapsedMs * 1000;
    lastMoveTimeRef.current = now;
    animateDragTilt(horizontalVelocity);
    movingRef.current = next;
    setMoving(next);
    setTarget(findTarget(next));
  }

  function animateDragTilt(horizontalVelocity: number) {
    const targetTilt = resolveCarriedPosterTilt(horizontalVelocity);
    const visibleTilt = dragTiltValueRef.current * 0.35 + targetTilt * 0.65;
    dragTilt.stopAnimation();
    dragTiltValueRef.current = visibleTilt;
    dragTilt.setValue(visibleTilt);
    if (dragTiltResetRef.current !== null) clearTimeout(dragTiltResetRef.current);
    dragTiltResetRef.current = setTimeout(() => {
      dragTiltResetRef.current = null;
      Animated.spring(dragTilt, {
        damping: 5, mass: 1.05, stiffness: 62, toValue: 0, useNativeDriver: false,
      }).start(({ finished }) => {
        if (finished) dragTiltValueRef.current = 0;
      });
    }, 120);
  }

  function resetDragAnimation() {
    if (dragTiltResetRef.current !== null) {
      clearTimeout(dragTiltResetRef.current);
      dragTiltResetRef.current = null;
    }
    dragScale.stopAnimation();
    dragTilt.stopAnimation();
    dragTiltValueRef.current = 0;
    dragScale.setValue(1);
    dragTilt.setValue(0);
  }

  useEffect(() => () => resetDragAnimation(), []);

  const rotation = dragTilt.interpolate({
    inputRange: [-24, 0, 24], outputRange: ['-24deg', '0deg', '24deg'],
  });

  return (
    <Modal animationType="slide" onRequestClose={onClose} visible>
      <SafeAreaView edges={['top', 'left', 'right']} style={styles.screen}>
        <View style={styles.header}>
          <Text accessibilityRole="header" style={styles.title}>Edit favorites</Text>
          <Button compact label="Done" onPress={onClose} variant="ghost" />
        </View>
        <WatchlistPage scrollRef={scrollRef} scrollEnabled={!moving}
          onContentSizeChange={(_width, height) => { viewport.current.contentHeight = height; }}
          onLayout={measure}
          onScroll={(event) => { viewport.current.offset = event.nativeEvent.contentOffset.y; measure(); }}
          overlay={<View pointerEvents="none" ref={overlayRef} onLayout={measure} style={StyleSheet.absoluteFill}>
            {moving ? <Animated.View style={[styles.carriedPoster, {
              left: moving.x - overlayOrigin.current.x - moving.gripX,
              top: moving.y - overlayOrigin.current.y - moving.gripY,
              width: moving.width,
              transform: [{ rotate: rotation }, { scale: dragScale }],
              transformOrigin: [moving.gripX, moving.gripY, 0],
            }]}><MediaPoster posterUrl={moving.item.posterUrl} style={styles.carriedPosterImage} /></Animated.View> : null}
          </View>}
        >
          <Text style={styles.hint}>Hold a poster, then drop it where you want it to appear.</Text>
          {error ? <View>
            <Text accessibilityLiveRegion="polite" style={styles.error}>{error}</Text>
            <Button compact label="Retry" onPress={onRetry} variant="ghost" />
          </View> : null}
          <View ref={gridRef} onLayout={(event) => { gridBounds.current = event.nativeEvent.layout; measure(); }} collapsable={false} style={styles.dropArea}>
            <WatchlistPosterGrid items={posters} movingItemId={moving?.item.id} dropTargetId={target} reordering
              onItemLayout={(item, layout) => layouts.current.set(item.id, layout)}
              onOpen={() => undefined}
              onMoveStart={(item, event, geometry) => {
                const next = { item, x: event.nativeEvent.pageX, y: event.nativeEvent.pageY, ...geometry };
                movingRef.current = next;
                setMoving(next);
                dragTiltValueRef.current = 0;
                lastMoveTimeRef.current = Date.now();
                dragTilt.setValue(0);
                dragScale.setValue(0.98);
                Animated.spring(dragScale, {
                  damping: 14, mass: 0.5, stiffness: 240, toValue: 1, useNativeDriver: false,
                }).start();
                measure();
                hapticSelection();
              }}
              onMove={updateMove}
              onMoveCancel={stopMove}
              onMoveEnd={(item, event) => {
                if (movingRef.current?.item.id !== item.id) return;
                const destination = findTarget({ x: event.nativeEvent.pageX, y: event.nativeEvent.pageY });
                const from = draft.findIndex((entry) => entry.key === item.id);
                const to = draft.findIndex((entry) => entry.key === destination);
                if (from >= 0 && to >= 0 && from !== to) {
                  const ordered = moveFavorite(draft, from, to);
                  setDraft(ordered);
                  onChange(ordered);
                  hapticSelection();
                }
                stopMove();
              }}
            />
          </View>
        </WatchlistPage>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.xl, paddingTop: spacing.sm },
  title: { ...typography.title, color: colors.text },
  hint: { ...typography.body, color: colors.textMuted },
  error: { ...typography.body, color: colors.danger },
  dropArea: { paddingBottom: spacing.xxxl },
  carriedPoster: { position: 'absolute', shadowColor: '#02040A', shadowOpacity: 0.5, shadowRadius: 18, shadowOffset: { width: 0, height: 12 } },
  carriedPosterImage: { aspectRatio: 2 / 3, borderColor: colors.accentText, borderRadius: radii.md, borderWidth: 2, width: '100%' },
});
