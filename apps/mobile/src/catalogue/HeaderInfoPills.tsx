import { StyleSheet, Text, View } from 'react-native';
import { Star } from 'lucide-react-native';
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
      {items.map((item, index) => (
        <View key={toItemKey(item)} style={styles.itemGroup}>
          {index > 0 ? <Text style={styles.separator}>/</Text> : null}
          {typeof item === 'string' ? (
            <Text style={styles.label}>{item}</Text>
          ) : (
            <View style={styles.ratingGroup}>
              <Star color={colors.accent} fill={colors.accent} size={11} strokeWidth={2} />
              <Text style={styles.label}>{item.label}</Text>
            </View>
          )}
        </View>
      ))}
    </View>
  );
}

function toItemKey(item: HeaderInfoItem) {
  return typeof item === 'string' ? item : `${item.icon}:${item.label}`;
}

const styles = StyleSheet.create({
  itemGroup: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
  },
  label: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0,
  },
  ratingGroup: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 3,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  separator: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
    opacity: 0.55,
  },
});
