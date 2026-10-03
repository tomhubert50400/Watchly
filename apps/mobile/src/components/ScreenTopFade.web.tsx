import { PropsWithChildren } from 'react';
import { StyleSheet, View } from 'react-native';

export function ScreenTopFade({ children, enabled }: PropsWithChildren<{ enabled: boolean }>) {
  return (
    <View style={[styles.container, {
      // React Native Web forwards CSS masks to the DOM.
      // @ts-expect-error maskImage is a web-only style.
      maskImage: enabled
        ? 'linear-gradient(to bottom, rgba(0, 0, 0, 0.55), rgba(0, 0, 0, 0.82) 8px, black 16px)'
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
