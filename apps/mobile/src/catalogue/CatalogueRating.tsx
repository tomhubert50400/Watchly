import { StyleSheet, Text } from 'react-native';
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
    <Text accessibilityLabel={`Rating ${label}`} numberOfLines={1} style={styles.rating}>
      {label}
    </Text>
  );
}

const styles = StyleSheet.create({
  rating: {
    ...typography.meta,
    color: colors.rating,
  },
});
