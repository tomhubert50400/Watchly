import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { spacing } from '../design/tokens';
import { ProgressCard } from '../library/ProgressCard';
import type { ProgressItem } from '../library/progressModel';

type ContinueWatchingRailProps = {
  items: ProgressItem[];
  isBusy: (item: ProgressItem) => boolean;
  onOpen: (item: ProgressItem) => void;
  onWatched: (item: ProgressItem) => void;
  onRetry: (item: ProgressItem) => void;
};

export function ContinueWatchingRail({ items, isBusy, onOpen, onWatched, onRetry }: ContinueWatchingRailProps) {
  const { width } = useWindowDimensions();
  return (
    <ScrollView contentContainerStyle={styles.rail} horizontal nestedScrollEnabled showsHorizontalScrollIndicator={false}>
      {items.map((item) => (
        <View key={item.media.key} style={{ width: Math.min(278, width - 64) }}>
          <ProgressCard item={item} busy={isBusy(item)} onOpen={() => onOpen(item)} onWatched={() => onWatched(item)} onRetry={() => onRetry(item)} />
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  rail: { gap: spacing.md, paddingRight: spacing.xl },
});
