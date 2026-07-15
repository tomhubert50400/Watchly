import { Star } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';
import { colors, typography } from '../design/tokens';
import { formatCatalogueRating } from './catalogueRatingModel';

type CatalogueRatingProps = {
  voteAverage: number | null;
};

export function CatalogueRating({ voteAverage }: CatalogueRatingProps) {
  const label = formatCatalogueRating(voteAverage);

  if (!label) {
    return null;
  }

  return (
    <View accessibilityLabel={`Rating ${label}`} accessible style={styles.row}>
      <Star color={colors.rating} fill={colors.rating} size={13} strokeWidth={2} />
      <Text numberOfLines={1} style={styles.rating}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  rating: {
    ...typography.meta,
    color: colors.rating,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 3,
  },
});
