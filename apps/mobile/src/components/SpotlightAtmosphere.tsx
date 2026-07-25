import { Image, StyleSheet, View } from 'react-native';

type SpotlightAtmosphereProps = {
  imageUrl: string | null;
};

export function SpotlightAtmosphere({ imageUrl }: SpotlightAtmosphereProps) {
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
      <Image
        accessibilityIgnoresInvertColors
        blurRadius={8}
        resizeMode="cover"
        source={{ uri: imageUrl }}
        style={styles.image}
      />
      <View style={styles.scrim} />
    </View>
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
    opacity: 0.82,
    position: 'absolute',
    right: -72,
    top: -72,
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(9, 12, 19, 0.48)',
  },
});
