import { Image, StyleSheet, View } from 'react-native';

const watchlyLogo = require('../../assets/watchly-logo-ui.png');

type BrandLogoProps = {
  size: number;
};

export function BrandLogo({ size }: BrandLogoProps) {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={[styles.frame, { height: size, width: size }]}
    >
      <Image
        accessible={false}
        accessibilityIgnoresInvertColors
        resizeMode="contain"
        source={watchlyLogo}
        style={styles.image}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    alignSelf: 'center',
    overflow: 'hidden',
  },
  image: {
    ...StyleSheet.absoluteFillObject,
  },
});
