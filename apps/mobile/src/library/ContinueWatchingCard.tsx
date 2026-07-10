import { ImageBackground, Pressable, StyleSheet, Text, View } from 'react-native';
import { Play } from 'lucide-react-native';
import { colors, radii, shadows, spacing, typography } from '../design/tokens';
import type { LibraryMediaItem } from './useLibraryData';

export function ContinueWatchingCard({ item, onPress }: { item: LibraryMediaItem; onPress: () => void }) {
  const episode = item.resumeSeasonNumber && item.resumeEpisodeNumber ? `Season ${item.resumeSeasonNumber} · Episode ${item.resumeEpisodeNumber}` : 'Continue watching';
  const denominator = Math.max(item.numberOfEpisodes ?? item.watchedEpisodeCount + 1, 1);
  const ratio = Math.min(1, item.watchedEpisodeCount / denominator);
  return <Pressable accessibilityLabel={`Continue ${item.title}, ${episode}`} accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
    <ImageBackground source={item.backdropUrl ? { uri: item.backdropUrl } : undefined} style={styles.background} imageStyle={styles.image}>
      <View style={styles.overlay} />
      <View style={styles.copy}><Text style={styles.eyebrow}>IN PROGRESS</Text><Text numberOfLines={1} style={styles.title}>{item.title}</Text><Text style={styles.meta}>{episode}</Text><View style={styles.track}><View style={[styles.progress, { width: `${ratio * 100}%` }]} /></View><View style={styles.button}><Play color={colors.textOnAccent} fill={colors.textOnAccent} size={14} /><Text style={styles.buttonText}>Continue</Text></View></View>
    </ImageBackground>
  </Pressable>;
}
const styles = StyleSheet.create({ card: { ...shadows.panel, borderRadius: radii.lg, height: 157, overflow: 'hidden' }, background: { flex: 1 }, image: { backgroundColor: colors.panelElevated }, overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(9,12,19,0.64)' }, copy: { alignItems: 'flex-start', flex: 1, padding: spacing.md, width: '72%' }, eyebrow: { ...typography.eyebrow, color: colors.accentText }, title: { color: colors.text, fontSize: 20, fontWeight: '800', marginTop: 4 }, meta: { ...typography.meta, color: colors.textMuted, marginTop: 2 }, track: { backgroundColor: colors.borderStrong, borderRadius: 2, height: 3, marginTop: spacing.sm, overflow: 'hidden', width: 154 }, progress: { backgroundColor: colors.accent, height: 3 }, button: { alignItems: 'center', backgroundColor: colors.accent, borderRadius: radii.md, flexDirection: 'row', gap: spacing.xs, marginTop: 'auto', minHeight: 36, paddingHorizontal: spacing.md }, buttonText: { color: colors.textOnAccent, fontSize: 13, fontWeight: '800' }, pressed: { opacity: 0.82 } });
