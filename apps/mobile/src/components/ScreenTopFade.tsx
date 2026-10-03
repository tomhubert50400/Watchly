import MaskedView from '@react-native-masked-view/masked-view';
import { PropsWithChildren } from 'react';
import { StyleSheet, UIManager, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

export function ScreenTopFade({ children, enabled }: PropsWithChildren<{ enabled: boolean }>) {
  if (!enabled || !UIManager.hasViewManagerConfig('RNCMaskedView')) {
    return <View style={styles.container}>{children}</View>;
  }

  return (
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
              y2="16"
            >
              <Stop offset="0" stopColor="black" stopOpacity={0.55} />
              <Stop offset="0.5" stopColor="black" stopOpacity={0.82} />
              <Stop offset="1" stopColor="black" stopOpacity={1} />
            </LinearGradient>
          </Defs>
          <Rect fill="url(#screenTopFade)" height="100%" width="100%" />
        </Svg>
      }
    >
      {children}
    </MaskedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
