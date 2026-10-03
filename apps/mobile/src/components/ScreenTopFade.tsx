import MaskedView from '@react-native-masked-view/masked-view';
import { BlurView } from 'expo-blur';
import { PropsWithChildren } from 'react';
import { Platform, StyleSheet, UIManager, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

export function ScreenTopFade({ children, enabled, topInset }: PropsWithChildren<{ enabled: boolean; topInset: number }>) {
  if (!enabled || !UIManager.hasViewManagerConfig('RNCMaskedView')) {
    return <View style={styles.container}>{children}</View>;
  }

  return (
    <View style={styles.container}>
      <MaskedView
        style={styles.container}
        maskElement={
          <Svg height="100%" width="100%">
            <Defs>
              <LinearGradient
                gradientUnits="userSpaceOnUse"
                id="screenTopFade"
                x1="0"
                x2="0"
                y1="0"
                y2={topInset}
              >
                <Stop offset="0" stopColor="black" stopOpacity={0.45} />
                <Stop offset="0.5" stopColor="black" stopOpacity={0.74} />
                <Stop offset="1" stopColor="black" stopOpacity={1} />
              </LinearGradient>
            </Defs>
            <Rect fill="url(#screenTopFade)" height="100%" width="100%" />
          </Svg>
        }
      >
        {children}
      </MaskedView>
      {Platform.OS === 'ios' ? (
        <MaskedView
          pointerEvents="none"
          style={[styles.topBlur, { height: topInset }]}
          maskElement={
            <Svg height="100%" width="100%">
              <Defs>
                <LinearGradient id="screenTopBlur" x1="0" x2="0" y1="0" y2="100%">
                  <Stop offset="0" stopColor="black" stopOpacity={1} />
                  <Stop offset="1" stopColor="black" stopOpacity={0} />
                </LinearGradient>
              </Defs>
              <Rect fill="url(#screenTopBlur)" height="100%" width="100%" />
            </Svg>
          }
        >
          <BlurView intensity={24} tint="dark" style={StyleSheet.absoluteFill} />
        </MaskedView>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topBlur: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
});
