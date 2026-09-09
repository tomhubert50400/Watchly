import { StyleSheet, View } from 'react-native';
import { colors, spacing } from '../design/tokens';

export function ProfileReviewsSkeleton({ count = 3 }: { count?: number }) {
  return (
    <View accessibilityLabel="Loading reviews" accessibilityRole="progressbar">
      {Array.from({ length: count }, (_, index) => (
        <View key={index} style={styles.card} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <View style={styles.header}>
            <View style={[styles.block, styles.poster]} />
            <View style={styles.copy}>
              <View style={[styles.block, styles.date]} />
              <View style={[styles.block, styles.title]} />
              <View style={[styles.block, styles.subtitle]} />
              <View style={[styles.block, styles.rating]} />
            </View>
          </View>
          <View style={[styles.block, styles.line]} />
          <View style={[styles.block, styles.line]} />
          <View style={[styles.block, styles.lastLine]} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { backgroundColor: colors.panelSoft, borderRadius: 4 },
  card: { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth, gap: spacing.sm, paddingTop: spacing.md, paddingBottom: spacing.xl },
  header: { flexDirection: 'row', gap: spacing.md, alignItems: 'center', marginBottom: spacing.sm },
  poster: { width: 58, height: 87, borderRadius: 8 },
  copy: { flex: 1, gap: spacing.sm },
  date: { width: '30%', height: 10 },
  title: { width: '80%', height: 18 },
  subtitle: { width: '40%', height: 10 },
  rating: { width: 90, height: 14 },
  line: { height: 14, width: '100%' },
  lastLine: { height: 14, width: '65%' },
});
