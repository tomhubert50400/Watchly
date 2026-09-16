import { ReleaseAlertControl } from '../notifications/ReleaseAlertControl';
import { Image, ImageBackground, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { colors, radii, shadows, spacing } from '../design/tokens';
import type { ProgressItem } from './progressModel';

export function ProgressCard({ item, busy, onOpen, onWatched, onRetry, compact = false }: {
  item: ProgressItem; busy: boolean; onOpen: () => void; onWatched: () => void; onRetry: () => void; compact?: boolean;
}) {
  const { media, next } = item;
  const premiereDate = item.nextSeasonAirDate?.split('-').reverse().join('/');
  const upToDate = premiereDate ? `Up to date: New season on ${premiereDate}` : 'Up to date: New season incoming';
  const caption = item.error ?? (next ? `Next · S${next.seasonNumber} E${next.episodeNumber}` : item.state === 'completed' ? 'Completed' : upToDate);
  const total = item.releasedEpisodeCount ?? 0;
  const watchedCount = item.watchedReleasedEpisodeCount ?? 0;
  const ratio = total ? Math.min(1, watchedCount / total) : 0;
  const cycleBadge = !item.error && (item.viewingCycle ?? 1) > 1 ? (
    <View style={styles.cycleBadge}><Text style={styles.cycleLabel}>×{item.viewingCycle}</Text></View>
  ) : null;
  return <View style={[styles.card, compact && styles.compactCard]}>
    <Pressable accessibilityRole="button" accessibilityLabel={`Open ${media.title}, ${caption}${cycleBadge ? `, viewing ${item.viewingCycle}` : ''}`} onPress={onOpen} style={({ pressed }) => [compact ? styles.compactOpen : styles.open, pressed && styles.pressed]}>
      {compact ? <>
        <Image accessible={false} source={media.posterUrl ? { uri: media.posterUrl } : undefined} style={styles.poster} />
        <View style={styles.compactCopy}>
          <Text numberOfLines={2} style={styles.compactTitle}>{media.title}</Text>
          <View style={styles.captionRow}><Text style={[styles.compactMeta, styles.caption]}>{caption}</Text>{cycleBadge}</View>
          {item.releasedEpisodeCount !== undefined ? <><View style={styles.track}><View style={[styles.progress, { width: `${ratio * 100}%` }]} /></View><Text style={styles.compactCount}>{watchedCount} / {total} episodes</Text></> : null}
        </View>
      </> : <ImageBackground source={media.backdropUrl || media.posterUrl ? { uri: media.backdropUrl ?? media.posterUrl! } : undefined} style={styles.background}>
        <Svg pointerEvents="none" style={StyleSheet.absoluteFill} width="100%" height="100%">
          <Defs><LinearGradient id={`progress-${media.tmdbId}`} x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor="#090C13" stopOpacity="0.12" /><Stop offset="0.4" stopColor="#090C13" stopOpacity="0.4" /><Stop offset="1" stopColor="#090C13" stopOpacity="0.95" /></LinearGradient></Defs>
          <Rect width="100%" height="100%" fill={`url(#progress-${media.tmdbId})`} />
        </Svg>
        <View style={styles.copy}>
          <Text numberOfLines={2} style={styles.title}>{media.title}</Text>
          <View style={styles.captionRow}><Text style={[styles.meta, styles.caption]}>{caption}</Text>{cycleBadge}</View>
          {item.releasedEpisodeCount !== undefined ? <><View style={styles.track}><View style={[styles.progress, { width: `${ratio * 100}%` }]} /></View><Text style={styles.count}>{watchedCount} / {total} episodes watched</Text></> : null}
        </View>
      </ImageBackground>}
    </Pressable>
    {item.error ? <Pressable accessibilityRole="button" accessibilityLabel={`Retry progress for ${media.title}`} onPress={onRetry} style={[styles.retry, compact && styles.compactAction]}><Text style={styles.retryText}>Retry</Text></Pressable> : next ?
      <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: false, disabled: busy, busy }} accessibilityLabel={`Mark ${media.title}, season ${next.seasonNumber}, episode ${next.episodeNumber} as watched`} disabled={busy} onPress={onWatched} style={[styles.checkTarget, compact && styles.compactAction]}>
        <View style={styles.circle} />
      </Pressable> : <View style={[styles.checkTarget, compact && styles.compactAction]}><ReleaseAlertControl contentType="series" tmdbId={media.tmdbId} /></View>}
  </View>;
}

const styles = StyleSheet.create({
  captionRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  caption: { flexShrink: 1 },
  cycleBadge: { flexShrink: 0, paddingHorizontal: 6, paddingVertical: 1, borderRadius: radii.sm, backgroundColor: colors.accentSoft, borderColor: colors.accentBorder, borderWidth: 1 },
  cycleLabel: { color: colors.accentText, fontSize: 10, lineHeight: 14, fontWeight: '700' },
  card: { ...shadows.panel, backgroundColor: colors.panelElevated, borderColor: colors.border, borderWidth: 1, borderRadius: radii.lg, overflow: 'hidden' },
  compactCard: { backgroundColor: 'transparent', borderWidth: 0, borderRadius: 0, shadowOpacity: 0, elevation: 0 },
  compactOpen: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, paddingRight: 66, minHeight: 104 },
  poster: { width: 49, height: 74, borderRadius: radii.sm, backgroundColor: colors.panelElevated },
  compactCopy: { flex: 1, minWidth: 0, gap: 4 },
  compactTitle: { color: colors.text, fontSize: 16, lineHeight: 20, fontWeight: '800' },
  compactMeta: { color: colors.textMuted, fontSize: 12, lineHeight: 17 },
  compactCount: { color: colors.textSubtle, fontSize: 11, lineHeight: 15 },
  compactAction: { bottom: '50%', marginBottom: -22 },
  open: { minHeight: 190 },
  background: { flex: 1, justifyContent: 'flex-end', minHeight: 190 },
  copy: { padding: spacing.md, paddingRight: 70, paddingTop: 65, gap: spacing.xs },
  title: { color: colors.text, fontSize: 24, lineHeight: 29, fontWeight: '800' },
  meta: { color: colors.text, fontSize: 13, lineHeight: 18 },
  count: { color: colors.textMuted, fontSize: 12, lineHeight: 17 },
  track: { height: 3, borderRadius: 2, backgroundColor: colors.borderStrong, overflow: 'hidden', marginTop: spacing.xs },
  progress: { height: 3, backgroundColor: colors.accent },
  checkTarget: { width: 44, height: 44, position: 'absolute', right: spacing.sm, bottom: spacing.sm, alignItems: 'center', justifyContent: 'center' },
  circle: { width: 30, height: 30, borderRadius: 15, borderWidth: 2, borderColor: colors.text, backgroundColor: 'rgba(9,12,19,0.5)', alignItems: 'center', justifyContent: 'center' },
  retry: { position: 'absolute', right: spacing.sm, bottom: spacing.sm, minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.xs },
  retryText: { color: colors.accentText, fontSize: 13, fontWeight: '700' },
  pressed: { opacity: 0.82 },
});
