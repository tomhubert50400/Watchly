import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../design/tokens';
import { getStarFillRatios, normalizeRating } from './cinematicPrimitives';

type StarRatingDisplayProps = {
  accessibilityLabel?: string;
  rating: number;
  showValue?: boolean;
  size?: number;
};

export function StarRatingDisplay({ accessibilityLabel, rating, showValue = false, size = 18 }: StarRatingDisplayProps) {
  const normalized = normalizeRating(rating);
  const fills = getStarFillRatios(normalized);
  const label = accessibilityLabel ?? `Rating ${normalized} out of 5`;

  return (
    <View accessibilityLabel={label} accessibilityRole="image" style={styles.container}>
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.stars}>
        {fills.map((fill, index) => (
          <View key={index} style={[styles.star, { height: size, width: size }]}>
            <Text style={[styles.glyph, { color: colors.textSubtle, fontSize: size, lineHeight: size }]}>★</Text>
            {fill > 0 ? (
              <View style={[styles.fillClip, { height: size, width: size * fill }]}>
                <Text style={[styles.glyph, { color: colors.rating, fontSize: size, lineHeight: size, width: size }]}>★</Text>
              </View>
            ) : null}
          </View>
        ))}
      </View>
      {showValue ? <Text style={[styles.value, { fontSize: Math.max(12, size * 0.65) }]}>{normalized.toFixed(1)} / 5</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  fillClip: {
    left: 0,
    overflow: 'hidden',
    position: 'absolute',
    top: 0,
  },
  glyph: {
    fontWeight: '800',
    includeFontPadding: false,
    left: 0,
    position: 'absolute',
    top: 0,
  },
  star: {
    position: 'relative',
  },
  stars: {
    flexDirection: 'row',
  },
  value: {
    color: colors.ratingText,
    fontWeight: '700',
    marginLeft: 7,
  },
});
