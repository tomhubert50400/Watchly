import { Menu } from 'lucide-react-native';
import { ComponentType, ReactNode, useEffect, useRef, useState } from 'react';
import { ActionSheetIOS, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, UIManager, useWindowDimensions, View, ViewProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radii, shadows, spacing, typography } from '../design/tokens';

type Action = { label: string; icon: ReactNode; nativeIcon?: string; onPress: () => void; disabled?: boolean; active?: boolean };
// The native view supports accessibility props, omitted from the package's wrapper type.
type AccessibleMenuView = ComponentType<import('@react-native-menu/menu').MenuComponentProps
  & Pick<ViewProps, 'accessible' | 'accessibilityRole' | 'accessibilityLabel'>>;

// Older builds and Expo Go do not contain the native view yet.
const NativeMenuView = Platform.OS === 'ios' && UIManager.getViewManagerConfig('MenuView')
  ? (require('@react-native-menu/menu') as typeof import('@react-native-menu/menu')).MenuView as AccessibleMenuView
  : null;

export function WatchlistActionsMenu({ actions }: { actions: Action[] }) {
  if (NativeMenuView) return <NativeMenuView
    accessible accessibilityRole="button" accessibilityLabel="Watchlist menu" style={styles.button}
    shouldOpenOnLongPress={false} themeVariant="dark"
    actions={actions.map((action, index) => ({
      id: String(index),
      title: action.label,
      image: action.nativeIcon,
      imageColor: action.active ? colors.accentText : colors.text,
      state: action.active ? 'on' : 'off',
      attributes: { disabled: Boolean(action.disabled) },
    }))}
    onPressAction={({ nativeEvent }) => {
      const action = actions[Number(nativeEvent.event)];
      if (action && !action.disabled) action.onPress();
    }}>
    <View pointerEvents="none" style={styles.nativeTrigger}>
      <Menu color={colors.text} size={22} />
    </View>
  </NativeMenuView>;
  if (Platform.OS === 'ios') return <WatchlistIOSActionSheet actions={actions} />;
  return <WatchlistPopupMenu actions={actions} />;
}

function WatchlistIOSActionSheet({ actions }: { actions: Action[] }) {
  const presented = useRef(false);
  return <Pressable accessibilityRole="button" accessibilityLabel="Watchlist menu"
    onPress={() => {
      if (presented.current) return;
      presented.current = true;
      ActionSheetIOS.showActionSheetWithOptions({
        title: 'Watchlist menu',
        options: [...actions.map((action) => `${action.active ? '✓ ' : ''}${action.label}`), 'Cancel'],
        cancelButtonIndex: actions.length,
        disabledButtonIndices: actions.flatMap((action, index) => action.disabled ? [index] : []),
        userInterfaceStyle: 'dark',
      }, (index) => {
        presented.current = false;
        const action = actions[index];
        if (action && !action.disabled) action.onPress();
      });
    }}
    style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
    <Menu color={colors.text} size={22} />
  </Pressable>;
}

function WatchlistPopupMenu({ actions }: { actions: Action[] }) {
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
    <Modal transparent animationType="none" visible={visible} onRequestClose={close} onDismiss={runPendingAction} statusBarTranslucent>
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
                runPendingAction();
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
  nativeTrigger: { alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' },
  overlay: { flex: 1 },
  menu: { ...shadows.raised, position: 'absolute', backgroundColor: colors.panelElevated, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.borderStrong, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: spacing.md },
  label: { ...typography.body, color: colors.text, flex: 1, minWidth: 0 },
  active: { color: colors.accentText },
  rowPressed: { backgroundColor: colors.segmentSelected },
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.4 },
});
