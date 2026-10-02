import { Menu } from 'lucide-react-native';
import { ReactNode, useEffect, useRef, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radii, shadows, spacing, typography } from '../design/tokens';

type Action = { label: string; icon: ReactNode; onPress: () => void; disabled?: boolean; active?: boolean };

export function WatchlistActionsMenu({ actions }: { actions: Action[] }) {
  const { width, height, fontScale } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const buttonRef = useRef<View>(null);
  const pendingAction = useRef<(() => void) | null>(null);
  const closing = useRef(false);
  const [visible, setVisible] = useState(false);
  const [anchor, setAnchor] = useState({ x: 0, y: 0 });
  const menuWidth = Math.min(280, width - spacing.md * 2);
  const rowHeight = Math.max(48, typography.body.lineHeight * fontScale + spacing.lg);

  useEffect(() => {
    pendingAction.current = null;
    setVisible(false);
  }, [width, height, fontScale]);
  useEffect(() => () => { pendingAction.current = null; }, []);

  function open() {
    buttonRef.current?.measureInWindow((x, y, buttonWidth, buttonHeight) => {
      setAnchor({
        x: Math.max(spacing.md, Math.min(x + buttonWidth - menuWidth, width - menuWidth - spacing.md)),
        y: Math.max(insets.top + spacing.sm, Math.min(y + buttonHeight + spacing.sm, height - insets.bottom - rowHeight * actions.length - spacing.md)),
      });
      closing.current = false;
      setVisible(true);
    });
  }

  function close() {
    pendingAction.current = null;
    closing.current = true;
    setVisible(false);
  }

  function runPendingAction() {
    const action = pendingAction.current;
    pendingAction.current = null;
    action?.();
  }

  return <>
    <Pressable ref={buttonRef} accessibilityRole="button" accessibilityLabel="Watchlist menu"
      accessibilityState={{ expanded: visible }} onPress={open}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
      <Menu color={colors.text} size={22} />
    </Pressable>
    <Modal transparent animationType="fade" visible={visible} onRequestClose={close} onDismiss={runPendingAction} statusBarTranslucent>
      <View style={styles.overlay}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close watchlist menu" onPress={close} style={StyleSheet.absoluteFill} />
        <View accessibilityViewIsModal onAccessibilityEscape={close}
          style={[styles.menu, { left: anchor.x, top: anchor.y, width: menuWidth, maxHeight: height - anchor.y - insets.bottom - spacing.md }]}>
          <ScrollView bounces={false}>
            {actions.map((action) => <Pressable key={action.label} accessibilityRole="button"
              accessibilityState={{ disabled: Boolean(action.disabled), selected: Boolean(action.active) }} disabled={action.disabled}
              onPress={() => {
                if (closing.current) return;
                closing.current = true;
                pendingAction.current = action.onPress;
                setVisible(false);
                // iOS must dismiss this modal before presenting an action's sheet.
                if (Platform.OS !== 'ios') runPendingAction();
              }}
              style={({ pressed }) => [styles.row, { minHeight: rowHeight }, action.disabled && styles.disabled, pressed && styles.rowPressed]}>
              {action.icon}
              <Text style={[styles.label, action.active && styles.active]}>{action.label}</Text>
            </Pressable>)}
          </ScrollView>
        </View>
      </View>
    </Modal>
  </>;
}

const styles = StyleSheet.create({
  button: { width: 44, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' },
  overlay: { flex: 1 },
  menu: { ...shadows.raised, position: 'absolute', backgroundColor: colors.panelElevated, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.borderStrong, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: spacing.md },
  label: { ...typography.body, color: colors.text, flex: 1, minWidth: 0 },
  active: { color: colors.accentText },
  rowPressed: { backgroundColor: colors.segmentSelected },
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.4 },
});
