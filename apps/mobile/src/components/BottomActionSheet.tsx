import { X } from 'lucide-react-native';
import {
  PropsWithChildren,
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Animated,
  Dimensions,
  Keyboard,
  KeyboardEvent,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  ScrollViewProps,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radii, spacing, touchTargets, typography } from '../design/tokens';
import {
  getBottomSheetDragOffset,
  shouldCaptureBottomSheetDrag,
  shouldDismissBottomSheet,
} from './bottomActionSheetGesture';
import { resolveBottomSheetKeyboardInset, resolveFocusedFieldScrollOffset } from './bottomActionSheetKeyboard';

type BottomActionSheetProps = PropsWithChildren<{
  dragFromHandleOnly?: boolean;
  footer?: ReactNode;
  onClose: () => void;
  title: string;
  visible: boolean;
}>;

type BottomActionSheetScrollViewProps = PropsWithChildren<ScrollViewProps>;

export function BottomActionSheetScrollView({
  automaticallyAdjustKeyboardInsets = false,
  children,
  contentContainerStyle,
  disableScrollViewPanResponder = true,
  keyboardDismissMode = Platform.OS === 'ios' ? 'interactive' : 'on-drag',
  keyboardShouldPersistTaps = 'handled',
  onFocus,
  onBlur,
  onLayout,
  onScroll,
  scrollEventThrottle = 16,
  ...scrollViewProps
}: BottomActionSheetScrollViewProps) {
  const scrollRef = useRef<ScrollView>(null);
  const focusedInput = useRef<ReturnType<typeof TextInput.State.currentlyFocusedInput> | null>(null);
  const scrollOffset = useRef(0);
  const scheduledFrame = useRef<number | null>(null);
  const measurementVersion = useRef(0);
  const revealFocusedInput = useCallback(() => {
    const version = ++measurementVersion.current;
    if (scheduledFrame.current !== null) cancelAnimationFrame(scheduledFrame.current);
    scheduledFrame.current = requestAnimationFrame(() => {
      scheduledFrame.current = null;
      const input = focusedInput.current;
      const scroll = scrollRef.current;
      if (!input || !scroll || TextInput.State.currentlyFocusedInput() !== input) return;
      scroll.getNativeScrollRef()?.measureInWindow((_x, viewportTop, _width, viewportHeight) => {
        input.measureInWindow((_inputX, fieldTop, _inputWidth, fieldHeight) => {
          if (version !== measurementVersion.current || focusedInput.current !== input || TextInput.State.currentlyFocusedInput() !== input) return;
          const y = resolveFocusedFieldScrollOffset({ scrollOffset: scrollOffset.current, viewportTop, viewportHeight, fieldTop, fieldHeight });
          if (Math.abs(y - scrollOffset.current) > 1) scroll.scrollTo({ y, animated: false });
        });
      });
    });
  }, []);

  useEffect(() => {
    const shown = Keyboard.addListener('keyboardDidShow', revealFocusedInput);
    return () => {
      shown.remove();
      focusedInput.current = null;
      if (scheduledFrame.current !== null) cancelAnimationFrame(scheduledFrame.current);
    };
  }, [revealFocusedInput]);

  return (
    <ScrollView
      {...scrollViewProps}
      ref={scrollRef}
      automaticallyAdjustKeyboardInsets={automaticallyAdjustKeyboardInsets}
      bounces={false}
      contentContainerStyle={styles.scrollContent}
      disableScrollViewPanResponder={disableScrollViewPanResponder}
      keyboardDismissMode={keyboardDismissMode}
      keyboardShouldPersistTaps={keyboardShouldPersistTaps}
      onFocus={(event) => {
        focusedInput.current = TextInput.State.currentlyFocusedInput();
        revealFocusedInput();
        onFocus?.(event);
      }}
      onBlur={(event) => {
        focusedInput.current = null;
        onBlur?.(event);
      }}
      onLayout={(event) => {
        revealFocusedInput();
        onLayout?.(event);
      }}
      onScroll={(event) => {
        scrollOffset.current = event.nativeEvent.contentOffset.y;
        onScroll?.(event);
      }}
      scrollEventThrottle={scrollEventThrottle}
      showsVerticalScrollIndicator={false}
    >
      <View
        onResponderTerminationRequest={() => true}
        onStartShouldSetResponder={() => disableScrollViewPanResponder}
        style={[styles.scrollGestureSurface, contentContainerStyle]}
      >
        {children}
      </View>
    </ScrollView>
  );
}

export function BottomActionSheet({ children, dragFromHandleOnly = false, footer, onClose, title, visible }: BottomActionSheetProps) {
  const safeAreaInsets = useSafeAreaInsets();
  const progress = useRef(new Animated.Value(0)).current;
  const dragY = useRef(new Animated.Value(0)).current;
  const isClosing = useRef(false);
  const [keyboardInset, setKeyboardInset] = useState(0);

  useEffect(() => {
    if (visible) {
      isClosing.current = false;
      dragY.setValue(0);
      progress.setValue(0);
      Animated.spring(progress, {
        damping: 24,
        mass: 0.9,
        stiffness: 240,
        toValue: 1,
        useNativeDriver: true,
      }).start();
    }
  }, [dragY, progress, visible]);

  useEffect(() => {
    if (!visible) {
      setKeyboardInset(0);
      return;
    }

    const currentKeyboard = Keyboard.metrics();
    setKeyboardInset(currentKeyboard ? getKeyboardInset(currentKeyboard) : 0);

    const syncWithKeyboard = (event: KeyboardEvent) => {
      Keyboard.scheduleLayoutAnimation(event);
      setKeyboardInset(getKeyboardInset(event.endCoordinates));
    };

    const subscriptions = Platform.OS === 'ios'
      ? [Keyboard.addListener('keyboardWillChangeFrame', syncWithKeyboard)]
      : [
          Keyboard.addListener('keyboardDidShow', syncWithKeyboard),
          Keyboard.addListener('keyboardDidHide', syncWithKeyboard),
        ];

    return () => {
      subscriptions.forEach((subscription) => subscription.remove());
    };
  }, [visible]);

  const requestClose = useCallback(() => {
    if (isClosing.current) {
      return;
    }

    isClosing.current = true;
    Keyboard.dismiss();
    Animated.timing(progress, {
      duration: 180,
      toValue: 0,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        onClose();
      } else {
        isClosing.current = false;
      }
    });
  }, [onClose, progress]);

  const snapBack = useCallback(() => {
    Animated.spring(dragY, {
      damping: 24,
      mass: 0.8,
      stiffness: 280,
      toValue: 0,
      useNativeDriver: true,
    }).start();
  }, [dragY]);

  const panResponder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponderCapture: (_, gesture) => (
      shouldCaptureBottomSheetDrag(gesture.dx, gesture.dy)
    ),
    onPanResponderMove: (_, gesture) => {
      dragY.setValue(getBottomSheetDragOffset(gesture.dy));
    },
    onPanResponderRelease: (_, gesture) => {
      if (shouldDismissBottomSheet(gesture.dy, gesture.vy)) {
        requestClose();
        return;
      }

      snapBack();
    },
    onPanResponderTerminate: snapBack,
  }), [dragY, requestClose, snapBack]);

  const backdropOpacity = Animated.multiply(
    progress,
    dragY.interpolate({
      extrapolate: 'clamp',
      inputRange: [0, 320],
      outputRange: [1, 0.45],
    }),
  );

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
        <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
          <Pressable accessibilityLabel="Close sheet" accessibilityRole="button" onPress={requestClose} style={StyleSheet.absoluteFill} />
        </Animated.View>
        <Animated.View
          {...(dragFromHandleOnly ? {} : panResponder.panHandlers)}
          accessibilityViewIsModal
          style={[
            styles.sheet,
            keyboardInset > 0 && { top: safeAreaInsets.top + spacing.sm },
            {
              transform: [{
                translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [640, 0] }),
              }, { translateY: dragY }],
            },
          ]}
        >
          <View style={[styles.keyboardFrame, { bottom: keyboardInset }]}>
            <SafeAreaView edges={keyboardInset > 0 ? [] : ['bottom']} style={styles.safeContent}>
              <View {...(dragFromHandleOnly ? panResponder.panHandlers : {})}>
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
              </View>
              <View style={styles.body}>{children}</View>
              {footer ? <View style={styles.footer}>{footer}</View> : null}
            </SafeAreaView>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

function getKeyboardInset(frame: KeyboardEvent['endCoordinates']) {
  return resolveBottomSheetKeyboardInset(frame, Dimensions.get('screen'));
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
  keyboardFrame: {
    ...StyleSheet.absoluteFillObject,
  },
  scrollContent: {
    flexGrow: 1,
  },
  scrollGestureSurface: {
    flexGrow: 1,
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
