import { PropsWithChildren } from 'react';
import { StyleSheet, View } from 'react-native';

export function ScreenTopFade({ children, enabled, topInset }: PropsWithChildren<{ enabled: boolean; topInset: number }>) {
  return (
    <View style={[styles.container, {
      // React Native Web forwards CSS masks to the DOM.
      // @ts-expect-error maskImage is a web-only style.
      maskImage: enabled
        ? `linear-gradient(to bottom, rgba(0, 0, 0, 0.45), rgba(0, 0, 0, 0.74) ${topInset / 2}px, black ${topInset}px)`
        : undefined,
    }]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
