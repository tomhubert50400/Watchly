import { type ReactNode, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Trash2 } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radii, shadows, spacing, typography } from '../design/tokens';
import { hapticSelection } from '../feedback/haptics';
import { type PosterMenuAnchor, posterMenuPosition } from './posterMenuPosition';

export function PosterActionsMenu({ children, enabled, disabled = false, actionLabel, label, onOpen, onRemove, title, width }: {
  children: ReactNode;
  enabled: boolean;
  disabled?: boolean;
  actionLabel: string;
  label: string;
  onOpen: () => void;
  onRemove: () => void;
  title: string;
  width: number;
}) {
  const viewport = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const cardRef = useRef<View>(null);
  const menuPresented = useRef(false);
  const closing = useRef(false);
  const pendingAction = useRef<(() => void) | null>(null);
  const reduceMotion = useRef(false);
  const scale = useRef(new Animated.Value(1)).current;
  const reveal = useRef(new Animated.Value(0)).current;
  const [anchor, setAnchor] = useState<PosterMenuAnchor | null>(null);
  const [menuHeight, setMenuHeight] = useState(0);

  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => { if (active) reduceMotion.current = value; }, () => { reduceMotion.current = true; });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', (value) => { reduceMotion.current = value; });
    return () => { active = false; subscription.remove(); menuPresented.current = false; pendingAction.current = null; scale.stopAnimation(); reveal.stopAnimation(); };
  }, [reveal, scale]);
  useEffect(() => {
    menuPresented.current = false;
    pendingAction.current = null;
    reveal.stopAnimation();
    setAnchor(null);
    scale.setValue(1);
  }, [viewport.width, viewport.height, viewport.fontScale, enabled, disabled, scale, reveal]);
  useEffect(() => {
    if (!anchor || !menuHeight) return;
    Animated.timing(reveal, { toValue: 1, duration: reduceMotion.current ? 0 : 160,
      easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [anchor, menuHeight, reveal]);

  function animateCard(toValue: number) {
    scale.stopAnimation();
    Animated.timing(scale, { toValue, duration: reduceMotion.current ? 0 : 180,
      easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }
  function runPendingAction() {
    const action = pendingAction.current;
    pendingAction.current = null;
    action?.();
  }
  function close(action?: () => void) {
    if (closing.current) return;
    closing.current = true;
    pendingAction.current = action ?? null;
    animateCard(1);
    Animated.timing(reveal, { toValue: 0, duration: reduceMotion.current ? 0 : 120, useNativeDriver: true }).start(({ finished }) => {
      if (!finished) return;
      menuPresented.current = false;
      setAnchor(null);
      if (Platform.OS !== 'ios') runPendingAction();
    });
  }
  function openMenu() {
    if (!enabled || disabled || menuPresented.current) return;
    menuPresented.current = true;
    closing.current = false;
    animateCard(0.96);
    cardRef.current?.measureInWindow((x, y, cardWidth, cardHeight) => {
      if (!menuPresented.current) return;
      if (!cardWidth || !cardHeight || y + cardHeight <= insets.top || y >= viewport.height - insets.bottom) {
        menuPresented.current = false;
        animateCard(1);
        return;
      }
      reveal.setValue(0);
      setMenuHeight(0);
      setAnchor({ x, y, width: cardWidth, height: cardHeight });
      hapticSelection();
    });
  }
  const position = anchor ? posterMenuPosition(anchor, viewport, insets, menuHeight || 56) : null;
  return <>
    <View ref={cardRef} collapsable={false} style={{ width }}>
      <Animated.View style={{ transform: [{ scale }] }}>
        <Pressable accessibilityLabel={label} accessibilityRole="button"
          accessibilityHint={enabled ? 'Long press for actions' : undefined}
          accessibilityActions={enabled ? [{ name: 'remove', label: actionLabel }] : undefined}
          onAccessibilityAction={({ nativeEvent }) => { if (nativeEvent.actionName === 'remove') openMenu(); }}
          accessibilityState={{ busy: disabled, disabled, expanded: Boolean(anchor) }} disabled={disabled}
          delayLongPress={350} onPressIn={() => animateCard(0.96)}
          onPressOut={() => { if (!menuPresented.current) animateCard(1); }}
          onPress={() => { if (!menuPresented.current) onOpen(); }}
          onLongPress={enabled ? openMenu : undefined}>
          {children}
        </Pressable>
      </Animated.View>
    </View>
    <Modal transparent animationType="none" visible={Boolean(anchor)} statusBarTranslucent navigationBarTranslucent
      onRequestClose={() => close()} onDismiss={runPendingAction}>
      <View style={styles.overlay} accessibilityViewIsModal onAccessibilityEscape={() => close()}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close title menu" onPress={() => close()} style={StyleSheet.absoluteFill} />
        {position ? <Animated.View style={[styles.menu, { left: position.x, top: position.y, width: position.width,
          opacity: reveal, transform: [{ translateY: reveal.interpolate({ inputRange: [0, 1], outputRange: [position.placement === 'below' ? -4 : 4, 0] }) }] }]}>
          <View pointerEvents="none" style={[styles.arrow, { left: position.arrowX - 5 }, position.placement === 'below' ? { top: -5 } : { bottom: -5 }]} />
          <ScrollView bounces={false} style={[styles.surface, { maxHeight: position.maxHeight }]}
            onContentSizeChange={(_width, height) => setMenuHeight(height + 2)}>
            <Pressable accessibilityRole="button" accessibilityLabel={`${actionLabel}, ${title}`} disabled={disabled}
              onPress={() => { if (enabled && !disabled) close(onRemove); }}
              style={({ pressed }) => [styles.action, pressed && styles.pressed]}>
              <Trash2 size={20} color={colors.danger} />
              <Text style={styles.label}>{actionLabel}</Text>
            </Pressable>
          </ScrollView>
        </Animated.View> : null}
      </View>
    </Modal>
  </>;
}

const styles = StyleSheet.create({
  overlay: { flex: 1 },
  menu: { ...shadows.raised, position: 'absolute' },
  surface: { flexGrow: 0, backgroundColor: colors.panelElevated, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.borderStrong },
  arrow: { position: 'absolute', width: 10, height: 10, backgroundColor: colors.panelElevated, transform: [{ rotate: '45deg' }] },
  action: { minHeight: 56, flexDirection: 'row', alignItems: 'center', padding: spacing.md, gap: spacing.sm },
  label: { ...typography.body, color: colors.danger, flex: 1 },
  pressed: { backgroundColor: colors.dangerBackground },
});
