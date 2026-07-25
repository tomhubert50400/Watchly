import { ImageBackground, StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button';
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
    <View style={styles.shell}>
      {imageUrl ? (
        <ImageBackground
          accessibilityIgnoresInvertColors
          accessibilityLabel={`${item.title} artwork`}
          imageStyle={styles.image}
          source={{ uri: imageUrl }}
          style={styles.imageBackground}
        >
          <View style={styles.scrim} />
          <HeroCopy item={item} metadata={metadata} onOpen={onOpen} />
        </ImageBackground>
      ) : (
        <View style={[styles.imageBackground, styles.placeholder]}>
          <HeroCopy item={item} metadata={metadata} onOpen={onOpen} />
        </View>
      )}
    </View>
  );
}

function HeroCopy({ item, metadata, onOpen }: HomeHeroProps & { metadata: string[] }) {
  return (
    <View style={styles.copy}>
      <Text style={styles.eyebrow}>Spotlight of the week</Text>
      <Text accessibilityRole="header" numberOfLines={2} style={styles.title}>
        {item.title}
      </Text>
      {metadata.length > 0 ? <Text style={styles.meta}>{metadata.join('  ·  ')}</Text> : null}
      <View style={styles.actions}>
        <Button accessibilityLabel={`Open ${item.title}`} label="View details" onPress={onOpen} />
      </View>
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
  actions: {
    alignItems: 'flex-start',
    marginTop: spacing.md,
  },
  copy: {
    alignItems: 'flex-start',
    justifyContent: 'flex-end',
    minHeight: 330,
    padding: spacing.lg,
    paddingTop: 120,
  },
  eyebrow: {
    ...typography.eyebrow,
    color: colors.accentText,
    marginBottom: spacing.xs,
  },
  image: {
    borderRadius: radii.lg,
  },
  imageBackground: {
    minHeight: 330,
  },
  meta: {
    ...typography.meta,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  placeholder: {
    backgroundColor: colors.panelElevated,
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
  },
});
