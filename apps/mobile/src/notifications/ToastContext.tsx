import { PropsWithChildren, createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radii, shadows, spacing, touchTargets } from '../design/tokens';

type ToastTone = 'error' | 'success';

type ToastState = {
  id: number;
  message: string;
  tone: ToastTone;
};

type ToastContextValue = {
  showToast: (message: string, tone?: ToastTone) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: PropsWithChildren) {
  const insets = useSafeAreaInsets();
  const [toast, setToast] = useState<ToastState | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progress = useRef(new Animated.Value(0)).current;

  const hideToast = useCallback(() => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }

    Animated.timing(progress, {
      duration: 170,
      toValue: 0,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        setToast(null);
      }
    });
  }, [progress]);

  const showToast = useCallback((message: string, tone: ToastTone = 'error') => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
    }

    setToast({
      id: Date.now(),
      message,
      tone,
    });
    progress.stopAnimation();
    progress.setValue(0);

    Animated.timing(progress, {
      duration: 190,
      toValue: 1,
      useNativeDriver: true,
    }).start();

    hideTimerRef.current = setTimeout(hideToast, 3200);
  }, [hideToast, progress]);

  useEffect(() => () => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
    }
  }, []);

  const value = useMemo(() => ({ showToast }), [showToast]);
  const toastStyle = {
    opacity: progress,
    transform: [
      {
        translateY: progress.interpolate({
          inputRange: [0, 1],
          outputRange: [12, 0],
        }),
      },
    ],
  };

  return (
    <ToastContext.Provider value={value}>
      <View pointerEvents="box-none" style={styles.host}>
        {children}
        {toast ? (
          <Animated.View
            pointerEvents="box-none"
            style={[
              styles.toastFrame,
              { bottom: insets.bottom + 18 },
              toastStyle,
            ]}
          >
            <Pressable
              accessibilityLabel="Dismiss notification"
              accessibilityRole="button"
              onPress={hideToast}
              style={[
                styles.toast,
                toast.tone === 'success' ? styles.successToast : styles.errorToast,
              ]}
            >
              <Text style={styles.toastText}>{toast.message}</Text>
            </Pressable>
          </Animated.View>
        ) : null}
      </View>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error('useToast must be used inside ToastProvider.');
  }

  return context;
}

const styles = StyleSheet.create({
  errorToast: {
    backgroundColor: colors.dangerBackground,
    borderColor: colors.dangerBorder,
  },
  host: {
    flex: 1,
  },
  successToast: {
    backgroundColor: colors.successBackground,
    borderColor: colors.successBorder,
  },
  toast: {
    ...shadows.panel,
    borderRadius: radii.lg,
    borderWidth: 1,
    minHeight: touchTargets.min,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  toastFrame: {
    left: spacing.md,
    position: 'absolute',
    right: spacing.md,
    zIndex: 30,
  },
  toastText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0,
    lineHeight: 18,
  },
});
