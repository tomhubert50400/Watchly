import { X } from 'lucide-react-native';
import { PropsWithChildren, ReactNode, useEffect, useRef } from 'react';
import { Animated, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radii, spacing, touchTargets, typography } from '../design/tokens';

type BottomActionSheetProps = PropsWithChildren<{
  footer?: ReactNode;
  onClose: () => void;
  title: string;
  visible: boolean;
}>;

export function BottomActionSheet({ children, footer, onClose, title, visible }: BottomActionSheetProps) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      progress.setValue(0);
      Animated.spring(progress, {
        damping: 24,
        mass: 0.9,
        stiffness: 240,
        toValue: 1,
        useNativeDriver: true,
      }).start();
    }
  }, [progress, visible]);

  const requestClose = () => {
    Animated.timing(progress, {
      duration: 180,
      toValue: 0,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) onClose();
    });
  };

  return (
    <Modal
      animationType="none"
      onRequestClose={requestClose}
      presentationStyle="overFullScreen"
      statusBarTranslucent
      transparent
      visible={visible}
    >
      <View style={styles.modal}>
        <Animated.View style={[styles.backdrop, { opacity: progress }]}>
          <Pressable accessibilityLabel="Close sheet" accessibilityRole="button" onPress={requestClose} style={StyleSheet.absoluteFill} />
        </Animated.View>
        <Animated.View
          accessibilityViewIsModal
          style={[
            styles.sheet,
            {
              transform: [{
                translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [640, 0] }),
              }],
            },
          ]}
        >
          <SafeAreaView edges={['bottom']} style={styles.safeContent}>
            <View style={styles.handle} />
            <View style={styles.header}>
              <Text accessibilityRole="header" style={styles.title}>{title}</Text>
              <Pressable
                accessibilityLabel="Close"
                accessibilityRole="button"
                hitSlop={4}
                onPress={requestClose}
                style={({ pressed }) => [styles.close, pressed ? styles.pressed : null]}
              >
                <X color={colors.textMuted} size={22} strokeWidth={2} />
              </Pressable>
            </View>
            <View style={styles.body}>{children}</View>
            {footer ? <View style={styles.footer}>{footer}</View> : null}
          </SafeAreaView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.overlay,
  },
  body: {
    flex: 1,
    paddingHorizontal: spacing.lg,
  },
  close: {
    alignItems: 'center',
    backgroundColor: colors.panelElevated,
    borderColor: colors.border,
    borderRadius: touchTargets.min / 2,
    borderWidth: 1,
    height: touchTargets.min,
    justifyContent: 'center',
    width: touchTargets.min,
  },
  footer: {
    borderTopColor: colors.border,
    borderTopWidth: 1,
    marginTop: spacing.lg,
    padding: spacing.lg,
  },
  handle: {
    alignSelf: 'center',
    backgroundColor: colors.borderStrong,
    borderRadius: 2,
    height: 4,
    marginBottom: spacing.sm,
    marginTop: spacing.sm,
    width: 42,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  modal: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  pressed: {
    opacity: 0.72,
  },
  safeContent: {
    flex: 1,
  },
  sheet: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.panel,
    borderColor: colors.borderStrong,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    borderTopWidth: 1,
    left: 0,
    right: 0,
    top: '18%',
  },
  title: {
    ...typography.title,
    color: colors.text,
    flex: 1,
    paddingRight: spacing.md,
  },
});
