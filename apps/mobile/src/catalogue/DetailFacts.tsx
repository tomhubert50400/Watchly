import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '../design/tokens';

export type DetailFact = {
  label: string;
  value: string | null;
};

type DetailFactsProps = {
  items: DetailFact[];
};

export function DetailFacts({ items }: DetailFactsProps) {
  const visibleItems = items.filter((item): item is DetailFact & { value: string } => Boolean(item.value));

  if (visibleItems.length === 0) {
    return null;
  }

  return (
    <View style={styles.panel}>
      <Text style={styles.sectionTitle}>Details</Text>
      <View style={styles.list}>
        {visibleItems.map((item) => (
          <View key={item.label} style={styles.row}>
            <Text style={styles.label}>{item.label}</Text>
            <Text style={styles.value}>{item.value}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    ...typography.eyebrow,
    color: colors.textSubtle,
    flexBasis: 112,
  },
  list: {
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  panel: {
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: spacing.xl,
  },
  row: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.md,
  },
  sectionTitle: {
    ...typography.title,
    color: colors.text,
  },
  value: {
    ...typography.body,
    color: colors.text,
    flex: 1,
    fontWeight: '700',
    marginTop: -3,
  },
});
