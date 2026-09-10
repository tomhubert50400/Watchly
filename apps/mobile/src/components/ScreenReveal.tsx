import { useIsFocused } from '@react-navigation/native';
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, type ViewProps } from 'react-native';

const RevealReadyContext = createContext(true);

/** Reveal once on the first visible mount, including content arriving after a skeleton. */
export function ScreenReveal({ children, delay = 0, ready = true, style, ...props }: ViewProps & { delay?: number; ready?: boolean }) {
  const parentReady = useContext(RevealReadyContext);
  const canReveal = ready && parentReady;
  const focused = useIsFocused();
  const progress = useRef(new Animated.Value(0)).current;
  const started = useRef(false);
  const [reduceMotion, setReduceMotion] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(
      value => { if (active) setReduceMotion(value); },
      () => { if (active) setReduceMotion(true); },
    );
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => { active = false; subscription.remove(); };
  }, []);

  useEffect(() => {
    if (!canReveal || reduceMotion === null) return;
    if (reduceMotion) {
      progress.stopAnimation();
      progress.setValue(1);
      started.current = true;
      return;
    }
    if (!focused || started.current) return;
    started.current = true;
    const animation = Animated.timing(progress, {
      toValue: 1,
      delay: Math.min(Math.max(delay, 0), 200),
      duration: 280,
      easing: Easing.out(Easing.cubic),
      isInteraction: false,
      useNativeDriver: true,
    });
    animation.start();
    return () => {
      animation.stop();
      progress.setValue(1);
    };
  }, [canReveal, delay, focused, progress, reduceMotion]);

  return (
    <Animated.View {...props} style={[style, canReveal ? {
      opacity: progress,
      transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }],
    } : null]}>
      <RevealReadyContext.Provider value={canReveal}>{children}</RevealReadyContext.Provider>
    </Animated.View>
  );
}
