import { Image, StyleSheet, View } from 'react-native';

const watchlyWordmark = require('../../assets/watchly-wordmark-ui.png');
const WORDMARK_ASPECT_RATIO = 512 / 189;

type BrandWordmarkProps = {
  height: number;
};

export function BrandWordmark({ height }: BrandWordmarkProps) {
  return (
    <View
      accessibilityLabel="Watchly"
      accessibilityRole="header"
      importantForAccessibility="yes"
      style={[styles.frame, { height, width: height * WORDMARK_ASPECT_RATIO }]}
    >
      <Image
        accessible={false}
        accessibilityIgnoresInvertColors
        resizeMode="contain"
        source={watchlyWordmark}
        style={styles.image}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    flexShrink: 0,
  },
  image: {
    ...StyleSheet.absoluteFillObject,
  },
});
