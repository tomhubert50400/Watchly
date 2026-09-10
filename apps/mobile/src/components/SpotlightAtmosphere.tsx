import { useIsFocused } from '@react-navigation/native';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, View } from 'react-native';

type SpotlightAtmosphereProps = {
  blurRadius?: number;
  fadeIn?: boolean;
  imageUrl: string | null;
};

const BACKDROP_OPACITY = 0.82;
const BACKDROP_FADE_DURATION_MS = 280;

export function SpotlightAtmosphere({
  blurRadius = 8,
  fadeIn = true,
  imageUrl,
}: SpotlightAtmosphereProps) {
  if (!imageUrl) {
    return null;
  }

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={styles.atmosphere}
    >
      <SpotlightImage
        blurRadius={blurRadius}
        fadeIn={fadeIn}
        imageUrl={imageUrl}
        key={imageUrl}
      />
      <View style={styles.scrim} />
    </View>
  );
}

function SpotlightImage({
  blurRadius,
  fadeIn,
  imageUrl,
}: {
  blurRadius: number;
  fadeIn: boolean;
  imageUrl: string;
}) {
  const focused = useIsFocused();
  const revealed = useRef(false);
  const opacity = useRef(new Animated.Value(fadeIn ? 0 : BACKDROP_OPACITY)).current;
  const [imageLoaded, setImageLoaded] = useState(!fadeIn);
  const [reduceMotionEnabled, setReduceMotionEnabled] = useState<boolean | null>(
    fadeIn ? null : false,
  );

  useEffect(() => {
    if (!fadeIn) return;

    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(
      (enabled) => {
        if (active) setReduceMotionEnabled(enabled);
      },
      () => {
        if (active) setReduceMotionEnabled(true);
      },
    );
    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReduceMotionEnabled,
    );

    return () => {
      active = false;
      subscription.remove();
    };
  }, [fadeIn]);

  useEffect(() => {
    if (!fadeIn || !imageLoaded || reduceMotionEnabled === null) return;

    if (reduceMotionEnabled) {
      opacity.setValue(BACKDROP_OPACITY);
      revealed.current = true;
      return;
    }

    if (!focused || revealed.current) return;
    revealed.current = true;
    opacity.setValue(0);
    const animation = Animated.timing(opacity, {
      duration: BACKDROP_FADE_DURATION_MS,
      easing: Easing.out(Easing.cubic),
      toValue: BACKDROP_OPACITY,
      useNativeDriver: true,
    });
    animation.start();

    return () => {
      animation.stop();
      opacity.setValue(BACKDROP_OPACITY);
    };
  }, [fadeIn, focused, imageLoaded, opacity, reduceMotionEnabled]);

  return (
    <Animated.Image
      accessibilityIgnoresInvertColors
      blurRadius={blurRadius}
      onLoad={() => setImageLoaded(true)}
      resizeMode="cover"
      source={{ uri: imageUrl }}
      style={[styles.image, { opacity }]}
    />
  );
}

const styles = StyleSheet.create({
  atmosphere: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  image: {
    bottom: -72,
    left: -72,
    position: 'absolute',
    right: -72,
    top: -72,
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(9, 12, 19, 0.48)',
  },
});
