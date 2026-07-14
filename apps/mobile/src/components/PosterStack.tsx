import { Image, StyleSheet, View } from 'react-native';
import { colors, radii } from '../design/tokens';

type PosterStackProps = {
  accessibilityLabel?: string;
  posterUrls: Array<string | null>;
  size?: 'compact' | 'regular';
};

const dimensions = {
  compact: { height: 64, offset: 12, width: 43 },
  regular: { height: 78, offset: 15, width: 53 },
} as const;

export function PosterStack({ accessibilityLabel, posterUrls, size = 'regular' }: PosterStackProps) {
  const shown = posterUrls.slice(0, 3);
  const frame = dimensions[size];
  const width = frame.width + Math.max(0, shown.length - 1) * (frame.width - frame.offset);

  return (
    <View accessibilityLabel={accessibilityLabel} accessibilityRole={accessibilityLabel ? 'image' : undefined} style={[styles.stack, { height: frame.height, width }]}>
      {shown.map((posterUrl, index) => (
        <View
          key={`${posterUrl ?? 'empty'}-${index}`}
          style={[
            styles.poster,
            {
              height: frame.height,
              left: index * (frame.width - frame.offset),
              width: frame.width,
              zIndex: shown.length - index,
            },
          ]}
        >
          {posterUrl ? (
            <Image accessibilityIgnoresInvertColors source={{ uri: posterUrl }} style={styles.image} />
          ) : (
            <View style={styles.placeholder} />
          )}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  image: {
    height: '100%',
    width: '100%',
  },
  placeholder: {
    backgroundColor: colors.panelElevated,
    flex: 1,
  },
  poster: {
    backgroundColor: colors.panelSoft,
    borderColor: colors.panel,
    borderRadius: radii.sm,
    borderWidth: 2,
    overflow: 'hidden',
    position: 'absolute',
    top: 0,
  },
  stack: {
    position: 'relative',
  },
});
