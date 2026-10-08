import { useCallback, useRef, useState } from 'react';
import { BlurView } from 'expo-blur';
import { Trash2 } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radii, spacing } from '../design/tokens';
import { hapticSelection } from '../feedback/haptics';
import { type DragPoint, type DragRect, isInsideTrash } from './watchlistTrashTarget';

export function useWatchlistTrashHeader(dragging: boolean) {
  const { top } = useSafeAreaInsets();
  const target = useRef<View>(null);
  const rect = useRef<DragRect | null>(null);
  const measurementVersion = useRef(0);
  const lastPoint = useRef<DragPoint | null>(null);
  const hovering = useRef(false);
  const [highlighted, setHighlighted] = useState(false);
  const update = useCallback((point: DragPoint | null) => {
    lastPoint.current = point;
    const inside = point !== null && isInsideTrash(point, rect.current);
    if (inside && !hovering.current) hapticSelection();
    hovering.current = inside;
    setHighlighted(inside);
  }, []);
  const measure = useCallback(() => {
    const view = target.current;
    const version = ++measurementVersion.current;
    // pageX/pageY share the responder event's coordinate space, including embedded roots.
    view?.measure((_x, _y, width, height, x, y) => {
      if (target.current !== view || measurementVersion.current !== version) return;
      rect.current = { x, y, width, height };
      update(lastPoint.current);
    });
  }, [update]);
  const isOverTrash = useCallback((point: DragPoint) => isInsideTrash(point, rect.current), []);
  const reset = useCallback(() => { measurementVersion.current += 1; rect.current = null; update(null); }, [update]);
  const header = useCallback(() => (
    <View pointerEvents="none" style={{ height: top + 84, backgroundColor: 'transparent' }}>
      <View ref={target} collapsable={false} onLayout={measure}
        accessible accessibilityRole="button" accessibilityLabel="Drop here to remove from watchlist"
        style={[styles.target, { top: top + 4 }, highlighted && styles.highlighted]}>
        <BlurView pointerEvents="none" intensity={highlighted ? 36 : 22} tint="dark" style={StyleSheet.absoluteFill} />
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.tint, highlighted && styles.highlightedTint]} />
        <Trash2 color={highlighted ? colors.text : colors.danger} size={30} strokeWidth={2}
          style={highlighted ? styles.highlightedIcon : undefined} />
      </View>
    </View>
  ), [highlighted, measure, top]);
  const updatePosition = useCallback((point: DragPoint) => { update(point); measure(); }, [measure, update]);
  return { header: dragging ? header : undefined, update: updatePosition, isOverTrash, reset };
}

const styles = StyleSheet.create({
  target: { position: 'absolute', left: spacing.md, right: spacing.md, height: 76, borderRadius: radii.xl,
    overflow: 'hidden', borderWidth: 1, borderColor: colors.dangerBorder,
    backgroundColor: 'rgba(18, 12, 20, 0.18)', alignItems: 'center', justifyContent: 'center' },
  tint: { backgroundColor: 'rgba(255, 120, 136, 0.06)' },
  highlighted: { borderColor: 'rgba(255, 120, 136, 0.8)' },
  highlightedTint: { backgroundColor: 'rgba(255, 120, 136, 0.22)' },
  highlightedIcon: { transform: [{ scale: 1.1 }] },
});
