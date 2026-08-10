import { Image, ImageBackground, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radii, shadows, spacing, typography } from '../design/tokens';
import type { HomeHeroItem } from './homeData';

type HomeHeroProps = {
  item: HomeHeroItem;
  onOpen: () => void;
};

export function HomeHero({ item, onOpen }: HomeHeroProps) {
  const imageUrl = item.backdropUrl ?? item.posterUrl;
  const metadata = [getYear(item.releaseDate), formatRuntime(item.runtimeMinutes), item.genres[0]]
    .filter((value): value is string => Boolean(value));

  return (
    <Pressable
      accessibilityHint="Opens the film details"
      accessibilityLabel={`Open ${item.title} details`}
      accessibilityRole="button"
      onPress={onOpen}
      style={({ pressed }) => [styles.shell, pressed ? styles.pressed : null]}
    >
      {imageUrl ? (
        <ImageBackground
          accessibilityIgnoresInvertColors
          accessible={false}
          imageStyle={styles.image}
          source={{ uri: imageUrl }}
          style={styles.imageBackground}
        >
          <View style={styles.scrim} />
          <HeroCopy item={item} metadata={metadata} />
        </ImageBackground>
      ) : (
        <View style={[styles.imageBackground, styles.placeholder]}>
          <HeroCopy item={item} metadata={metadata} />
        </View>
      )}
    </Pressable>
  );
}

function HeroCopy({ item, metadata }: { item: HomeHeroItem; metadata: string[] }) {
  return (
    <View style={styles.copy}>
      <Text style={styles.eyebrow}>SPOTLIGHT OF THE WEEK</Text>
      {item.logoUrl ? (
        <View
          accessibilityLabel={item.title}
          accessibilityRole="header"
          accessible
          style={styles.logoFrame}
        >
          <Image
            accessibilityIgnoresInvertColors
            accessible={false}
            resizeMode="contain"
            source={{ uri: item.logoUrl }}
            style={[styles.logo, { aspectRatio: item.logoAspectRatio ?? 3 }]}
          />
        </View>
      ) : (
        <Text accessibilityRole="header" numberOfLines={2} style={styles.title}>
          {item.title}
        </Text>
      )}
      {metadata.length > 0 ? <Text style={styles.meta}>{metadata.join('  ·  ')}</Text> : null}
    </View>
  );
}

function getYear(value: string | null) {
  return value?.match(/^\d{4}/)?.[0] ?? null;
}

function formatRuntime(runtimeMinutes: number | null) {
  if (!runtimeMinutes || runtimeMinutes < 1) {
    return null;
  }

  const hours = Math.floor(runtimeMinutes / 60);
  const minutes = runtimeMinutes % 60;

  if (hours === 0) {
    return `${minutes} min`;
  }

  return minutes > 0 ? `${hours} hr ${minutes} min` : `${hours} hr`;
}

const styles = StyleSheet.create({
  copy: {
    alignItems: 'center',
    justifyContent: 'flex-end',
    minHeight: 330,
    padding: spacing.lg,
  },
  eyebrow: {
    ...typography.eyebrow,
    color: colors.accentText,
    fontSize: 14,
    fontWeight: '900',
    left: spacing.lg,
    letterSpacing: 1.1,
    position: 'absolute',
    top: spacing.lg,
  },
  image: {
    borderRadius: radii.lg,
  },
  imageBackground: {
    minHeight: 330,
  },
  logo: {
    height: '100%',
    maxWidth: '100%',
  },
  logoFrame: {
    alignItems: 'center',
    alignSelf: 'center',
    height: 58,
    width: '82%',
  },
  meta: {
    ...typography.meta,
    color: colors.textMuted,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  placeholder: {
    backgroundColor: colors.panelElevated,
  },
  pressed: {
    opacity: 0.92,
    transform: [{ scale: 0.99 }],
  },
  scrim: {
    backgroundColor: 'rgba(5, 7, 12, 0.48)',
    ...StyleSheet.absoluteFillObject,
  },
  shell: {
    ...shadows.raised,
    backgroundColor: colors.panel,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  title: {
    color: colors.text,
    fontSize: 30,
    fontWeight: '900',
    letterSpacing: -0.6,
    lineHeight: 34,
    textAlign: 'center',
  },
});
