import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { Image, ImageBackground, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { DiscoverItem } from '../api/discover';
import { colors, radii, spacing, typography } from '../design/tokens';
import { useCatalogueCache } from './CatalogueCacheContext';

export function DiscoverCarousel({ items, onOpen }: { items: DiscoverItem[]; onOpen: (item: DiscoverItem) => void }) {
  const scroll = useRef<ScrollView>(null);
  const [width, setWidth] = useState(0);
  const [index, setIndex] = useState(0);
  const { getCachedMovie, getCachedSeries } = useCatalogueCache();
  const signature = items.map(item => item.id).join(',');
  useEffect(() => { setIndex(0); scroll.current?.scrollTo({ x: 0, animated: false }); }, [signature, width]);
  const go = (next: number) => {
    const selected = Math.max(0, Math.min(items.length - 1, next));
    setIndex(selected); scroll.current?.scrollTo({ x: selected * width, animated: true });
  };
  return <View onLayout={event => setWidth(event.nativeEvent.layout.width)}>
    <View style={styles.heading}>
      <Text accessibilityRole="header" style={styles.sectionTitle}>Picked for you</Text>
      {items.length > 1 ? <View style={styles.arrows}>
        <Pressable accessibilityLabel="Previous recommendation" accessibilityRole="button" accessibilityState={{ disabled: index === 0 }} disabled={index === 0} onPress={() => go(index - 1)} style={[styles.arrow, index === 0 && styles.disabled]}><ChevronLeft color={colors.accentText} size={18} /></Pressable>
        <Pressable accessibilityLabel="Next recommendation" accessibilityRole="button" accessibilityState={{ disabled: index === items.length - 1 }} disabled={index === items.length - 1} onPress={() => go(index + 1)} style={[styles.arrow, index === items.length - 1 && styles.disabled]}><ChevronRight color={colors.accentText} size={18} /></Pressable>
      </View> : null}
    </View>
    {width > 0 ? <ScrollView horizontal pagingEnabled decelerationRate="fast" ref={scroll} showsHorizontalScrollIndicator={false}
      onMomentumScrollEnd={event => setIndex(Math.max(0, Math.min(items.length - 1, Math.round(event.nativeEvent.contentOffset.x / width))))}>
      {items.map(item => {
        const details = item.mediaType === 'movie' ? getCachedMovie(item.tmdbId) : getCachedSeries(item.tmdbId);
        return <View key={item.id} style={{ width }}>
          <Pressable accessibilityLabel={`Open ${item.title}`} accessibilityRole="button" onPress={() => onOpen(item)} style={styles.hero}>
            <ImageBackground source={{ uri: item.backdropUrl ?? item.posterUrl ?? undefined }} style={styles.artwork}>
              <View style={styles.scrim} />
              <View style={styles.copy}>
                {details?.logoUrl ? <Image accessibilityLabel={item.title} resizeMode="contain" source={{ uri: details.logoUrl }} style={[styles.logo, { aspectRatio: details.logoAspectRatio ?? 3 }]} /> : <Text numberOfLines={2} style={styles.title}>{item.title}</Text>}
                <Text style={styles.meta}>{item.mediaType === 'movie' ? 'Movie' : 'TV Show'}{item.releaseDate ? ` · ${item.releaseDate.slice(0, 4)}` : ''}</Text>
              </View>
            </ImageBackground>
          </Pressable>
          <Text style={styles.reason}>{item.reason}</Text>
        </View>;
      })}
    </ScrollView> : null}
    {items.length > 1 ? <View style={styles.dots}>{items.map((item, position) => <Pressable
      accessibilityLabel={`Recommendation ${position + 1} of ${items.length}: ${item.title}`} accessibilityRole="button" accessibilityState={{ selected: position === index }}
      key={item.id} onPress={() => go(position)} style={styles.dotTarget}
    ><View style={[styles.dot, position === index && styles.dotSelected]} /></Pressable>)}</View> : null}
  </View>;
}
const styles = StyleSheet.create({
  heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm, gap: spacing.sm },
  sectionTitle: { ...typography.title, color: colors.text, flex: 1 },
  arrows: { flexDirection: 'row', gap: spacing.xs },
  arrow: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.interactiveSurface, alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.35 }, hero: { borderRadius: radii.lg, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  artwork: { height: 200, justifyContent: 'flex-end' }, scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.28)' },
  copy: { padding: spacing.md, backgroundColor: 'rgba(9,12,19,0.22)' }, title: { fontSize: 28, lineHeight: 33, fontWeight: '800', color: colors.text },
  logo: { height: 49, maxWidth: '85%' }, meta: { ...typography.meta, color: colors.textMuted, marginTop: spacing.xs },
  reason: { fontSize: 12, lineHeight: 18, color: colors.accentText, marginTop: spacing.sm },
  dots: { flexDirection: 'row', justifyContent: 'center' }, dotTarget: { width: 38, height: 44, justifyContent: 'center', alignItems: 'center' },
  dot: { width: 6, height: 6, borderRadius: 5, backgroundColor: colors.textSubtle }, dotSelected: { width: 18, backgroundColor: colors.accentText },
});
