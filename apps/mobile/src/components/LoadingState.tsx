import { StyleSheet, View } from 'react-native';
import { colors, radii, spacing } from '../design/tokens';

type LoadingStateProps = {
  label: string;
  variant?: 'list' | 'people' | 'episodes' | 'settings' | 'grid' | 'detail' | 'profile' | 'feed' | 'stats';
  count?: number;
};

export function LoadingState({ label, variant = 'list', count = 3 }: LoadingStateProps) {
  const cards = variant === 'grid' || variant === 'detail' || variant === 'profile';
  return (
    <View accessibilityLabel={label} accessibilityLiveRegion="polite" accessibilityRole="progressbar" accessibilityState={{ busy: true }} style={styles.container}>
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.content}>
        {variant === 'detail' || variant === 'profile' || variant === 'stats' ? <View style={styles.content}>
          <View style={[styles.block, variant === 'profile' ? styles.portrait : styles.hero]} />
          <View style={[styles.block, styles.heading]} />
          <View style={[styles.block, styles.line]} />
          <View style={[styles.block, styles.shortLine]} />
        </View> : null}
        <View style={cards ? styles.grid : styles.content}>
          {Array.from({ length: cards ? 4 : count }, (_, index) => (
            <View key={index} style={cards ? styles.card : styles.rowGroup}>
              <View style={cards ? styles.content : styles.row}>
                {variant !== 'settings' && variant !== 'stats' ? <View style={[
                  styles.block,
                  cards ? styles.poster
                    : variant === 'people' || variant === 'feed' ? styles.avatar
                    : variant === 'episodes' ? styles.still : styles.thumbnail,
                ]} /> : null}
                <View style={styles.copy}>
                  <View style={[styles.block, styles.title]} />
                  <View style={[styles.block, styles.shortLine]} />
                </View>
                {variant === 'settings' ? <View style={[styles.block, styles.toggle]} /> : null}
              </View>
              {variant === 'feed' ? <View style={styles.content}>
                <View style={[styles.block, styles.line]} />
                <View style={[styles.block, styles.shortLine]} />
                <View style={[styles.block, styles.feedImage]} />
              </View> : null}
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignSelf: 'stretch', width: '100%', paddingVertical: spacing.md },
  content: { gap: spacing.md },
  block: { backgroundColor: colors.panelSoft, borderRadius: 4 },
  rowGroup: { gap: spacing.md, paddingVertical: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  copy: { flex: 1, gap: spacing.sm, minWidth: 0 },
  title: { height: 18, width: '80%' },
  line: { height: 14, width: '100%' },
  shortLine: { height: 12, width: '50%' },
  heading: { height: 28, width: '65%' },
  avatar: { width: 48, height: 48, borderRadius: 24 },
  portrait: { width: 112, height: 112, borderRadius: 56 },
  thumbnail: { width: 48, height: 72, borderRadius: radii.sm },
  still: { width: 112, height: 74, borderRadius: radii.sm },
  toggle: { width: 44, height: 28, borderRadius: 14 },
  hero: { width: '100%', aspectRatio: 16 / 9, borderRadius: radii.lg },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  card: { flexBasis: '44%', flexGrow: 1, maxWidth: '50%' },
  poster: { width: '100%', aspectRatio: 2 / 3, borderRadius: radii.md },
  feedImage: { width: '100%', height: 120, borderRadius: radii.md },
});
