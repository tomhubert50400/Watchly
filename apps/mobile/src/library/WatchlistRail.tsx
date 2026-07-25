import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, {
  Defs,
  Image as SvgImage,
  Mask,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';
import { colors, radii, shadows, spacing } from '../design/tokens';
import type { LibraryListItem } from './useLibraryData';

export function WatchlistRail({ lists, onOpen }: { lists: LibraryListItem[]; onOpen: (list: LibraryListItem) => void }) {
  return <ScrollView contentContainerStyle={styles.rail} horizontal showsHorizontalScrollIndicator={false}>
    {lists.map((list, index) => <Pressable accessibilityLabel={`Open ${list.name}`} accessibilityRole="button" key={list.key} onPress={() => onOpen(list)} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <BlendedArtwork blendId={`watchlist-art-${index}`} urls={list.posterUrls} />
      <View style={styles.overlay} />
      <Text numberOfLines={2} style={styles.title}>{list.name}</Text>
    </Pressable>)}
  </ScrollView>;
}

const ARTWORK_HEIGHT = 156;
const ARTWORK_WIDTH = 278;

function BlendedArtwork({ blendId, urls }: { blendId: string; urls: Array<string | null> }) {
  const shown = urls.filter((url): url is string => Boolean(url)).slice(0, 4);

  if (shown.length === 0) return <View style={styles.placeholder} />;

  if (shown.length === 1) {
    return (
      <Image
        accessibilityIgnoresInvertColors
        accessible={false}
        resizeMode="cover"
        source={{ uri: shown[0] }}
        style={styles.singleArtwork}
      />
    );
  }

  const layers = getArtworkLayers(shown.length);

  return (
    <View style={styles.artwork}>
      <Svg
        accessible={false}
        height="100%"
        pointerEvents="none"
        style={styles.collage}
        viewBox={`0 0 ${ARTWORK_WIDTH} ${ARTWORK_HEIGHT}`}
        width="100%"
      >
        <Defs>
          {layers.map((layer, index) => (
            <RadialGradient
              cx={layer.cx}
              cy={layer.cy}
              gradientUnits="userSpaceOnUse"
              id={`${blendId}-gradient-${index}`}
              key={`${blendId}-gradient-${index}`}
              rx={layer.rx}
              ry={layer.ry}
            >
              <Stop offset="0" stopColor="#FFFFFF" stopOpacity="1" />
              <Stop offset="0.52" stopColor="#FFFFFF" stopOpacity="1" />
              <Stop offset="0.72" stopColor="#FFFFFF" stopOpacity="0.62" />
              <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
            </RadialGradient>
          ))}
          {layers.map((_, index) => (
            <Mask
              height={ARTWORK_HEIGHT}
              id={`${blendId}-mask-${index}`}
              key={`${blendId}-mask-${index}`}
              maskUnits="userSpaceOnUse"
              width={ARTWORK_WIDTH}
              x="0"
              y="0"
            >
              <Rect
                fill={`url(#${blendId}-gradient-${index})`}
                height={ARTWORK_HEIGHT}
                width={ARTWORK_WIDTH}
              />
            </Mask>
          ))}
        </Defs>
        {shown.map((url, index) => {
          const layer = layers[index];
          return (
            <SvgImage
              height={ARTWORK_HEIGHT}
              href={{ uri: url }}
              key={`${url}-${index}`}
              mask={`url(#${blendId}-mask-${index})`}
              preserveAspectRatio="xMidYMid slice"
              width={ARTWORK_WIDTH}
              x={layer.imageX}
              y={layer.imageY}
            />
          );
        })}
      </Svg>
    </View>
  );
}

const twoArtworkLayers = [
  { cx: 0, cy: 78, imageX: -55, imageY: 0, rx: 160, ry: 230 },
  { cx: 278, cy: 78, imageX: 55, imageY: 0, rx: 160, ry: 230 },
] as const;

const threeArtworkLayers = [
  { cx: 0, cy: 0, imageX: -70, imageY: -39, rx: 190, ry: 115 },
  { cx: 278, cy: 0, imageX: 70, imageY: -39, rx: 175, ry: 110 },
  { cx: 139, cy: 156, imageX: 0, imageY: 39, rx: 230, ry: 95 },
] as const;

const fourArtworkLayers = [
  { cx: 0, cy: 0, imageX: -70, imageY: -39, rx: 205, ry: 130 },
  { cx: 278, cy: 0, imageX: 70, imageY: -39, rx: 175, ry: 110 },
  { cx: 0, cy: 156, imageX: -70, imageY: 39, rx: 175, ry: 110 },
  { cx: 278, cy: 156, imageX: 70, imageY: 39, rx: 175, ry: 110 },
] as const;

function getArtworkLayers(count: number) {
  if (count === 2) return twoArtworkLayers;
  if (count === 3) return threeArtworkLayers;
  return fourArtworkLayers;
}

const styles = StyleSheet.create({
  artwork: {
    ...StyleSheet.absoluteFillObject,
  },
  card: {
    ...shadows.panel,
    alignItems: 'center',
    backgroundColor: colors.panelElevated,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    height: 156,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 278,
  },
  collage: {
    ...StyleSheet.absoluteFillObject,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(9, 12, 19, 0.16)',
  },
  placeholder: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.panelElevated,
  },
  pressed: {
    opacity: 0.8,
  },
  rail: {
    gap: spacing.sm,
    paddingRight: spacing.xl,
  },
  singleArtwork: {
    ...StyleSheet.absoluteFillObject,
  },
  title: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '800',
    lineHeight: 29,
    maxWidth: '82%',
    position: 'absolute',
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.72)',
    textShadowOffset: { height: 1, width: 0 },
    textShadowRadius: 8,
  },
});
