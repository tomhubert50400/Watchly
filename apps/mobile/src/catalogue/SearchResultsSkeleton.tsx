import { StyleSheet, View } from 'react-native';
import { colors, radii, spacing } from '../design/tokens';

export function SearchResultsSkeleton({ actors, titles }: { actors: boolean; titles: boolean }) {
  return (
    <View accessibilityLabel="Loading search results" accessibilityRole="progressbar" accessibilityState={{ busy: true }}>
      <View style={styles.content} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {actors ? <View style={styles.actors}>
          <View style={[styles.block, styles.heading]} />
          <View style={styles.rail}>
            {[0, 1, 2, 3, 4].map(index => <View key={index} style={styles.actor}>
              <View style={[styles.block, styles.portrait]} />
              <View style={[styles.block, styles.name]} />
            </View>)}
          </View>
        </View> : null}
        {titles ? <View style={styles.content}>
          <View style={[styles.block, styles.heading]} />
          <View style={styles.grid}>
            {[0, 1, 2, 3].map(index => <View key={index} style={styles.card}>
              <View style={[styles.block, styles.poster]} />
              <View style={[styles.block, styles.title]} />
              <View style={[styles.block, styles.meta]} />
            </View>)}
          </View>
        </View> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.lg },
  block: { backgroundColor: colors.panelSoft, borderRadius: 4 },
  heading: { width: 88, height: 25 },
  actors: { gap: spacing.md, paddingBottom: spacing.lg, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  rail: { flexDirection: 'row', gap: spacing.md, overflow: 'hidden' },
  actor: { width: 88, alignItems: 'center', gap: spacing.sm },
  portrait: { width: 72, height: 72, borderRadius: 36 },
  name: { width: 64, height: 17 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  card: { flexBasis: '47%', flexGrow: 1, maxWidth: '50%', gap: spacing.sm },
  poster: { width: '100%', aspectRatio: 2 / 3, borderRadius: radii.md },
  title: { width: '85%', height: 18 },
  meta: { width: '45%', height: 17 },
});
