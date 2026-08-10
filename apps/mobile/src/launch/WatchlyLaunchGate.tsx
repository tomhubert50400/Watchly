import {
  createContext,
  PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  Animated,
  Easing,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, {
  Defs,
  LinearGradient as SvgLinearGradient,
  Rect,
  Stop,
} from 'react-native-svg';
import { colors, spacing } from '../design/tokens';
import { launchTimeline } from './launchAnimationModel';

const watchlyW = require('../../assets/watchly-w-ui.png');
const watchlyPopcorn = require('../../assets/watchly-popcorn-ui.png');
const watchlyLetters = require('../../assets/watchly-letters-ui.png');
const watchlyWordmark = require('../../assets/watchly-wordmark-ui.png');

const LETTER_REVEAL_FEATHER = 24;
const LAUNCH_ASSET_WAIT_MS = 400;
const WORDMARK_ASPECT_RATIO = 512 / 189;
// Visible W bounds: wordmark x 5-140, y 45-157; isolated layer x 7-249, y 77-239.
const WORDMARK_W_ASPECT_CORRECTION = (112 / 162) / (135 / 242);
const WORDMARK_W_CENTER_X_RATIO = 145 / 1_024;
const WORDMARK_W_CENTER_Y_RATIO = 6_501 / 15_309;
const WORDMARK_W_WIDTH_RATIO = 135 / 484;
const KERNELS = [
  { delay: 280, lane: -0.27, size: 17 },
  { delay: 410, lane: 0.18, size: 14 },
  { delay: 540, lane: -0.05, size: 19 },
  { delay: 670, lane: 0.31, size: 16 },
  { delay: 800, lane: -0.2, size: 15 },
  { delay: 930, lane: 0.07, size: 18 },
  { delay: 1_060, lane: 0.25, size: 14 },
  { delay: 1_190, lane: -0.32, size: 17 },
  { delay: 1_320, lane: 0.02, size: 16 },
] as const;

const AppReadyContext = createContext<((ready: boolean) => void) | null>(null);

export function WatchlyLaunchGate({ children }: PropsWithChildren) {
  const [appReady, setAppReady] = useState(false);
  const reportAppReady = useCallback((ready: boolean) => {
    setAppReady(ready);
  }, []);

  return (
    <AppReadyContext.Provider value={reportAppReady}>
      <View style={styles.gate}>
        {children}
        <WatchlyLaunchAnimation appReady={appReady} />
      </View>
    </AppReadyContext.Provider>
  );
}

export function useAppLaunchReadiness(ready: boolean) {
  const reportAppReady = useContext(AppReadyContext);

  if (!reportAppReady) {
    throw new Error('useAppLaunchReadiness must be used inside WatchlyLaunchGate.');
  }

  useEffect(() => {
    reportAppReady(ready);
  }, [ready, reportAppReady]);
}

function WatchlyLaunchAnimation({ appReady }: { appReady: boolean }) {
  const { height, width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [blocksTouches, setBlocksTouches] = useState(true);
  const [dockComplete, setDockComplete] = useState(false);
  const [latestRevealReached, setLatestRevealReached] = useState(false);
  const [visible, setVisible] = useState(true);
  const [assetsReady, setAssetsReady] = useState(false);
  const loadedAssetsRef = useRef(new Set<string>());
  const startedAtRef = useRef(Date.now());
  const revealStartedRef = useRef(false);
  const finishTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intro = useRef(new Animated.Value(0)).current;
  const fill = useRef(new Animated.Value(0)).current;
  const deploy = useRef(new Animated.Value(0)).current;
  const letters = useRef(new Animated.Value(0)).current;
  const dock = useRef(new Animated.Value(0)).current;
  const contentReveal = useRef(new Animated.Value(0)).current;
  const kernelProgress = useRef(
    KERNELS.map(() => new Animated.Value(0)),
  ).current;
  const markAssetReady = useCallback((asset: string) => {
    loadedAssetsRef.current.add(asset);
    if (loadedAssetsRef.current.size === 4) setAssetsReady(true);
  }, []);

  useEffect(() => {
    if (assetsReady) return;

    const fallbackTimer = setTimeout(() => setAssetsReady(true), LAUNCH_ASSET_WAIT_MS);
    return () => clearTimeout(fallbackTimer);
  }, [assetsReady]);

  useEffect(() => {
    if (!assetsReady) return;

    startedAtRef.current = Date.now();
    const launch = Animated.parallel([
      delayedTiming(
        intro,
        launchTimeline.introStartMs,
        launchTimeline.introEndMs - launchTimeline.introStartMs,
        Easing.out(Easing.back(1.12)),
      ),
      delayedTiming(
        fill,
        launchTimeline.fillStartMs,
        launchTimeline.fillEndMs - launchTimeline.fillStartMs,
        Easing.out(Easing.cubic),
      ),
      delayedTiming(
        deploy,
        launchTimeline.deployStartMs,
        launchTimeline.deployEndMs - launchTimeline.deployStartMs,
        Easing.inOut(Easing.cubic),
      ),
      delayedTiming(
        letters,
        launchTimeline.lettersStartMs,
        launchTimeline.lettersEndMs - launchTimeline.lettersStartMs,
        Easing.inOut(Easing.cubic),
      ),
      delayedTiming(
        dock,
        launchTimeline.dockStartMs,
        launchTimeline.dockEndMs - launchTimeline.dockStartMs,
        Easing.inOut(Easing.cubic),
      ),
      ...kernelProgress.map((progress, index) => delayedTiming(
        progress,
        KERNELS[index].delay,
        900,
        Easing.inOut(Easing.cubic),
      )),
    ]);
    const latestRevealTimer = setTimeout(
      () => setLatestRevealReached(true),
      launchTimeline.revealLatestStartMs,
    );

    launch.start(({ finished }) => {
      if (finished) setDockComplete(true);
    });

    return () => {
      launch.stop();
      clearTimeout(latestRevealTimer);
      if (finishTimerRef.current) clearTimeout(finishTimerRef.current);
    };
  }, [assetsReady, deploy, dock, fill, intro, kernelProgress, letters]);

  useEffect(() => {
    if (
      !dockComplete ||
      revealStartedRef.current ||
      !(appReady || latestRevealReached)
    ) {
      return;
    }

    revealStartedRef.current = true;
    Animated.timing(contentReveal, {
      duration: launchTimeline.revealDurationMs,
      easing: Easing.out(Easing.cubic),
      toValue: 1,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (!finished) return;

      setBlocksTouches(false);
      const elapsed = Date.now() - startedAtRef.current;
      const remaining = Math.max(0, launchTimeline.minimumDurationMs - elapsed);
      finishTimerRef.current = setTimeout(() => setVisible(false), remaining);
    });
  }, [appReady, contentReveal, dockComplete, latestRevealReached]);

  if (!visible) return null;

  const stageCenterY = height * (760 / 1_560);
  const initialIconSize = Math.min(width * 0.36, 148);
  const largeWordmarkWidth = width * (578 / 720);
  const largeWordmarkHeight = largeWordmarkWidth / WORDMARK_ASPECT_RATIO;
  const largeWordmarkLeft = (width - largeWordmarkWidth) / 2;
  const largeWordmarkTop = stageCenterY - largeWordmarkHeight / 2;
  const deployedIconSize =
    largeWordmarkWidth * WORDMARK_W_WIDTH_RATIO;
  const deployedIconCenterX =
    largeWordmarkLeft + largeWordmarkWidth * WORDMARK_W_CENTER_X_RATIO;
  const deployedIconCenterY =
    largeWordmarkTop + largeWordmarkHeight * WORDMARK_W_CENTER_Y_RATIO;
  const letterRevealOriginX =
    largeWordmarkLeft + largeWordmarkWidth * (112 / 512);
  const letterRevealEndX =
    largeWordmarkLeft + largeWordmarkWidth + LETTER_REVEAL_FEATHER;
  const targetWordmarkHeight = 44;
  const targetWordmarkWidth = targetWordmarkHeight * WORDMARK_ASPECT_RATIO;
  const targetWordmarkLeft = spacing.xl;
  const targetWordmarkTop = insets.top + spacing.xl + 5;
  const targetWordmarkCenterX = targetWordmarkLeft + targetWordmarkWidth / 2;
  const targetWordmarkCenterY = targetWordmarkTop + targetWordmarkHeight / 2;
  const targetIconSize =
    targetWordmarkWidth * WORDMARK_W_WIDTH_RATIO;
  const targetIconCenterX =
    targetWordmarkLeft + targetWordmarkWidth * WORDMARK_W_CENTER_X_RATIO;
  const targetIconCenterY =
    targetWordmarkTop + targetWordmarkHeight * WORDMARK_W_CENTER_Y_RATIO;

  const introScale = intro.interpolate({
    inputRange: [0, 1],
    outputRange: [0.84, 1],
  });
  const iconScale = Animated.add(
    Animated.add(
      introScale,
      deploy.interpolate({
        inputRange: [0, 1],
        outputRange: [0, deployedIconSize / initialIconSize - 1],
      }),
    ),
    dock.interpolate({
      inputRange: [0, 1],
      outputRange: [
        0,
        targetIconSize / initialIconSize - deployedIconSize / initialIconSize,
      ],
    }),
  );
  const iconTranslateX = Animated.add(
    deploy.interpolate({
      inputRange: [0, 1],
      outputRange: [0, deployedIconCenterX - width / 2],
    }),
    dock.interpolate({
      inputRange: [0, 1],
      outputRange: [0, targetIconCenterX - deployedIconCenterX],
    }),
  );
  const iconTranslateY = Animated.add(
    deploy.interpolate({
      inputRange: [0, 1],
      outputRange: [0, deployedIconCenterY - stageCenterY],
    }),
    dock.interpolate({
      inputRange: [0, 1],
      outputRange: [0, targetIconCenterY - deployedIconCenterY],
    }),
  );
  const letterRevealTranslateX = letters.interpolate({
    inputRange: [0, 1],
    outputRange: [-largeWordmarkWidth * (24 / 512), 0],
  });
  const letterDockTranslateX = dock.interpolate({
    inputRange: [0, 1],
    outputRange: [0, targetWordmarkCenterX - width / 2],
  });
  const letterDockTranslateY = dock.interpolate({
    inputRange: [0, 1],
    outputRange: [0, targetWordmarkCenterY - stageCenterY],
  });
  const letterDockScale = dock.interpolate({
    inputRange: [0, 1],
    outputRange: [1, targetWordmarkWidth / largeWordmarkWidth],
  });
  const curtainTranslateX = letters.interpolate({
    inputRange: [0, 1],
    outputRange: [0, letterRevealEndX - letterRevealOriginX],
  });
  const leftCurtainOpacity = letters.interpolate({
    inputRange: [0, 0.96, 1],
    outputRange: [1, 1, 0],
  });
  const backgroundOpacity = Animated.subtract(1, contentReveal);
  const assembledLogoOpacity = dock.interpolate({
    inputRange: [0, 0.88, 1],
    outputRange: [1, 1, 0],
  });
  const finalWordmarkOpacity = dock.interpolate({
    inputRange: [0, 0.88, 1],
    outputRange: [0, 0, 1],
  });
  const popcornTranslateY = fill.interpolate({
    inputRange: [0, 1],
    outputRange: [initialIconSize * 0.42, 0],
  });
  const popcornOpacity = fill.interpolate({
    inputRange: [0, 0.12, 1],
    outputRange: [0, 1, 1],
  });

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents={blocksTouches ? 'auto' : 'none'}
      style={styles.overlay}
    >
      <Animated.View style={[styles.backdrop, { opacity: backgroundOpacity }]} />

      <Animated.View
        style={[
          styles.lettersStage,
          {
            height: largeWordmarkHeight,
            left: largeWordmarkLeft,
            opacity: assembledLogoOpacity,
            top: largeWordmarkTop,
            transform: [
              { translateX: letterDockTranslateX },
              { translateY: letterDockTranslateY },
              { scale: letterDockScale },
            ],
            width: largeWordmarkWidth,
          },
        ]}
      >
        <Animated.Image
          onLoad={() => markAssetReady('letters')}
          resizeMode="contain"
          source={watchlyLetters}
          style={[
            styles.letters,
            {
              height: largeWordmarkHeight,
              transform: [{ translateX: letterRevealTranslateX }],
              width: largeWordmarkWidth,
            },
          ]}
        />
      </Animated.View>

      <Animated.View
        style={[
          styles.letterCurtain,
          {
            opacity: Animated.multiply(backgroundOpacity, leftCurtainOpacity),
            width: letterRevealOriginX,
          },
        ]}
      />
      <Animated.View
        style={[
          styles.letterCurtain,
          {
            left: letterRevealOriginX,
            opacity: backgroundOpacity,
            transform: [{ translateX: curtainTranslateX }],
            width: width - letterRevealOriginX + LETTER_REVEAL_FEATHER,
          },
        ]}
      >
        <Svg
          height="100%"
          style={styles.letterCurtainFeather}
          viewBox={`0 0 ${LETTER_REVEAL_FEATHER} 1`}
          width={LETTER_REVEAL_FEATHER}
        >
          <Defs>
            <SvgLinearGradient id="letterRevealFeather" x1="0" x2="1" y1="0" y2="0">
              <Stop offset="0" stopColor={colors.background} stopOpacity="0" />
              <Stop offset="1" stopColor={colors.background} stopOpacity="1" />
            </SvgLinearGradient>
          </Defs>
          <Rect
            fill="url(#letterRevealFeather)"
            height="1"
            width={LETTER_REVEAL_FEATHER}
          />
        </Svg>
      </Animated.View>

      <Animated.View
        style={[
          styles.iconStage,
          {
            height: initialIconSize,
            left: width / 2 - initialIconSize / 2,
            opacity: assembledLogoOpacity,
            top: stageCenterY - initialIconSize / 2,
            transform: [
              { translateX: iconTranslateX },
              { translateY: iconTranslateY },
              { scale: iconScale },
            ],
            width: initialIconSize,
          },
        ]}
      >
        <View
          style={[
            styles.popcornClip,
            {
              height: initialIconSize * 0.64,
              width: initialIconSize,
            },
          ]}
        >
          <Animated.Image
            onLoad={() => markAssetReady('popcorn')}
            resizeMode="contain"
            source={watchlyPopcorn}
            style={{
              height: initialIconSize,
              opacity: popcornOpacity,
              transform: [{ translateY: popcornTranslateY }],
              width: initialIconSize,
            }}
          />
        </View>

        {kernelProgress.map((progress, index) => (
          <PopcornKernel
            iconSize={initialIconSize}
            index={index}
            key={index}
            progress={progress}
          />
        ))}

        <Animated.Image
          onLoad={() => markAssetReady('w')}
          resizeMode="contain"
          source={watchlyW}
          style={[
            styles.logoLayer,
            {
              height: initialIconSize,
              transform: [{ scaleY: WORDMARK_W_ASPECT_CORRECTION }],
              width: initialIconSize,
            },
          ]}
        />
      </Animated.View>

      <Animated.Image
        onLoad={() => markAssetReady('wordmark')}
        resizeMode="contain"
        source={watchlyWordmark}
        style={[
          styles.finalWordmark,
          {
            height: largeWordmarkHeight,
            left: largeWordmarkLeft,
            opacity: finalWordmarkOpacity,
            top: largeWordmarkTop,
            transform: [
              { translateX: letterDockTranslateX },
              { translateY: letterDockTranslateY },
              { scale: letterDockScale },
            ],
            width: largeWordmarkWidth,
          },
        ]}
      />
    </Animated.View>
  );
}

function PopcornKernel({
  iconSize,
  index,
  progress,
}: {
  iconSize: number;
  index: number;
  progress: Animated.Value;
}) {
  const kernel = KERNELS[index];
  const size = kernel.size;
  const translateY = progress.interpolate({
    inputRange: [0, 0.78, 0.9, 1],
    outputRange: [
      -iconSize * (2.45 + (index % 4) * 0.3),
      0,
      -iconSize * 0.12,
      0,
    ],
  });
  const opacity = progress.interpolate({
    inputRange: [0, 0.06, 0.78, 1],
    outputRange: [0, 1, 1, 0],
  });
  const rotate = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', `${index % 2 === 0 ? 210 : -195}deg`],
  });

  return (
    <Animated.View
      style={[
        styles.kernel,
        {
          height: size,
          left: iconSize / 2 + kernel.lane * iconSize - size / 2,
          opacity,
          top: iconSize * 0.3,
          transform: [{ translateY }, { rotate }],
          width: size,
        },
      ]}
    >
      <View style={[styles.kernelLobe, styles.kernelLobeLeft]} />
      <View style={[styles.kernelLobe, styles.kernelLobeRight]} />
      <View style={[styles.kernelLobe, styles.kernelLobeTop]} />
    </Animated.View>
  );
}

function delayedTiming(
  value: Animated.Value,
  delay: number,
  duration: number,
  easing: (value: number) => number,
) {
  return Animated.sequence([
    Animated.delay(delay),
    Animated.timing(value, {
      duration,
      easing,
      toValue: 1,
      useNativeDriver: true,
    }),
  ]);
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.background,
  },
  gate: {
    backgroundColor: colors.background,
    flex: 1,
  },
  finalWordmark: {
    position: 'absolute',
  },
  iconStage: {
    position: 'absolute',
  },
  kernel: {
    position: 'absolute',
    zIndex: 3,
  },
  kernelLobe: {
    backgroundColor: '#FFE0A0',
    borderRadius: 999,
    height: '72%',
    position: 'absolute',
    width: '72%',
  },
  kernelLobeLeft: {
    bottom: 0,
    left: 0,
  },
  kernelLobeRight: {
    bottom: 0,
    right: 0,
  },
  kernelLobeTop: {
    backgroundColor: '#FFF0C2',
    left: '14%',
    top: 0,
  },
  letterCurtain: {
    backgroundColor: colors.background,
    bottom: 0,
    position: 'absolute',
    top: 0,
  },
  letterCurtainFeather: {
    bottom: 0,
    left: -LETTER_REVEAL_FEATHER,
    position: 'absolute',
    top: 0,
    width: LETTER_REVEAL_FEATHER,
  },
  letters: {
    left: 0,
    position: 'absolute',
    top: 0,
  },
  lettersStage: {
    position: 'absolute',
  },
  logoLayer: {
    left: 0,
    position: 'absolute',
    top: 0,
    zIndex: 2,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
    zIndex: 1_000,
  },
  popcornClip: {
    left: 0,
    overflow: 'hidden',
    position: 'absolute',
    top: 0,
    zIndex: 1,
  },
});
