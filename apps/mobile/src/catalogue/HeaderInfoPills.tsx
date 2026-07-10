import { Star } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '../design/tokens';

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
    <View accessibilityLabel={toAccessibilityLabel(items)} style={styles.row}>
      {items.map((item, index) => (
        <View key={toItemKey(item)} style={styles.item}>
          {index > 0 ? <Text style={styles.separator}>·</Text> : null}
          {typeof item === 'string' ? null : (
            <Star color={colors.rating} fill={colors.rating} size={13} strokeWidth={2} />
          )}
          <Text style={[styles.label, typeof item === 'string' ? null : styles.ratingLabel]}>
            {typeof item === 'string' ? item : `${item.label} / 5`}
          </Text>
        </View>
      ))}
    </View>
  );
}

function toAccessibilityLabel(items: HeaderInfoItem[]) {
  return items
    .map((item) => (typeof item === 'string' ? item : `Rating ${item.label} out of 5`))
    .join(', ');
}

function toItemKey(item: HeaderInfoItem) {
  return typeof item === 'string' ? item : `${item.icon}:${item.label}`;
}

const styles = StyleSheet.create({
  item: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 3,
  },
  label: {
    ...typography.meta,
    color: colors.textMuted,
  },
  ratingLabel: {
    color: colors.ratingText,
  },
  row: {
    alignItems: 'center',
    columnGap: spacing.xs,
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: spacing.sm,
  },
  separator: {
    color: colors.textSubtle,
    marginRight: spacing.xs,
  },
});
