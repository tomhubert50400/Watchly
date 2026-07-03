import { StyleSheet, View } from 'react-native';
import { Star } from 'lucide-react-native';
import { Chip } from '../components/Chip';
import { colors, spacing } from '../design/tokens';

export type HeaderInfoItem =
  | string
  | {
      icon: 'star';
      label: string;
    };

type HeaderInfoPillsProps = {
  items: HeaderInfoItem[];
};

export function HeaderInfoPills({ items }: HeaderInfoPillsProps) {
  if (items.length === 0) {
    return null;
  }

  return (
    <View style={styles.row}>
      {items.map((item) => (
        <Chip
          icon={
            typeof item === 'string' ? undefined : (
              <Star color={colors.rating} fill={colors.rating} size={11} strokeWidth={2} />
            )
          }
          key={toItemKey(item)}
          label={typeof item === 'string' ? item : item.label}
          tone={typeof item === 'string' ? 'neutral' : 'rating'}
        />
      ))}
    </View>
  );
}

function toItemKey(item: HeaderInfoItem) {
  return typeof item === 'string' ? item : `${item.icon}:${item.label}`;
}

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
});
