import { useCallback, useRef } from 'react';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Globe, Lock } from 'lucide-react-native';
import { Image, ImageBackground, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { getProfileHistory, type ProfileHistory } from '../api/profile';
import { ApiError } from '../api/client';
import { useAuthSession } from '../auth/AuthSessionContext';
import { useCachedResource } from '../cache/useCachedResource';
import { getPrivateCacheKey } from '../cache/persistedCache';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { StarRatingDisplay } from '../components/StarRatingDisplay';
import { colors, radii, spacing, typography } from '../design/tokens';
import type { RootStackParamList } from '../navigation/types';
import { useUserDataRevision } from '../sync/userDataEvents';

export function RecentViewingActivity({ userId, owner = false }: { userId: string; owner?: boolean }) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { currentUser, getFirebaseIdToken } = useAuthSession();
  const revision = useUserDataRevision('viewings', 'opinions', 'episodeProgress', 'profile', 'socialGraph');
  const key = getPrivateCacheKey(currentUser?.id ?? 'visitor', `profile:recent-viewings:${userId}:v1`);
  const load = useCallback(async (): Promise<ProfileHistory> => {
    const token = await getFirebaseIdToken();
    if (!token) throw new Error('Sign in to view activity.');
    try {
      return await getProfileHistory(token, userId, true);
    } catch (error) {
      if (error instanceof ApiError && (error.status === 403 || error.status === 404)) {
        return { visibility: 'private', items: [], opinions: [] };
      }
      throw error;
    }
  }, [currentUser?.id, getFirebaseIdToken, userId, revision]);
  const resource = useCachedResource({ key, load, enabled: Boolean(currentUser), staleTimeMs: owner ? 5 * 60 * 1000 : 0 });
  const savedAt = useRef(resource.savedAt);
  savedAt.current = resource.savedAt;
  useFocusEffect(useCallback(() => {
    if (savedAt.current && (!owner || Date.now() - Date.parse(savedAt.current) >= 5 * 60 * 1000)) resource.revalidate();
  }, [key, owner, resource.revalidate]));
  const data = resource.data;
  const status = data ? 'ready' : resource.error ? 'error' : 'loading';
  if (!owner && (data && data.visibility !== 'public')) return null;
  return <View style={styles.section}>
    <View style={styles.header}>
      <View style={styles.headingRow}><Text style={styles.heading}>Recent activity</Text>{owner && data ? <Pressable accessibilityRole="button" accessibilityLabel={`Manage viewing history visibility, currently ${data.visibility}`} onPress={() => navigation.navigate('Settings')} style={styles.visibility}>{data.visibility === 'public' ? <Globe color={colors.textSubtle} size={15} /> : <Lock color={colors.textSubtle} size={15} />}</Pressable> : null}</View>
      {owner || status === 'ready' || status === 'error' ? <Pressable accessibilityRole="button" onPress={() => navigation.navigate('Journal', owner ? undefined : { userId })} style={styles.link}><Text style={styles.linkText}>View history</Text></Pressable> : null}
    </View>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
    {data?.items.map((item) => {
      const opinion = data.opinions.find((opinion) => {
        const content = opinion.content;
        return item.contentType === 'movie' ? content.contentType === 'movie' && content.tmdbId === item.tmdbId
          : content.contentType === 'episode' && content.seriesTmdbId === item.tmdbId && content.seasonNumber === item.seasonNumber && content.episodeNumber === item.episodeNumber;
      });
      const title = item.title ?? (item.contentType === 'movie' ? 'Movie' : 'Series');
      return <Pressable accessibilityRole="button" accessibilityLabel={`Open ${title}`} key={item.id} onPress={() => navigation.navigate(item.contentType === 'movie' ? 'FilmDetail' : 'SeriesDetail', { title, tmdbId: item.tmdbId })} style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}>
        {item.posterUrl ? <Image accessible={false} blurRadius={12} source={{ uri: item.posterUrl }} style={StyleSheet.absoluteFill} /> : null}
        <ImageBackground source={item.posterUrl ? { uri: item.posterUrl } : undefined} imageStyle={styles.reducedArtwork} style={styles.artwork}>
          <Svg pointerEvents="none" style={StyleSheet.absoluteFill} width="100%" height="100%">
            <Defs><LinearGradient id={`activity-${item.id}`} x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor="#090C13" stopOpacity="0.12" /><Stop offset="0.4" stopColor="#090C13" stopOpacity="0.4" /><Stop offset="1" stopColor="#090C13" stopOpacity="0.95" /></LinearGradient></Defs>
            <Rect width="100%" height="100%" fill={`url(#activity-${item.id})`} />
          </Svg>
        <View style={styles.copy}><Text numberOfLines={1} style={styles.title}>{title}</Text><Text numberOfLines={1} style={styles.cardMeta}>{item.contentType === 'episode' ? `S${item.seasonNumber} E${item.episodeNumber} · ` : ''}{new Date(item.watchedAt).toLocaleDateString('en-US', { day: 'numeric', month: 'short', timeZone: 'UTC' })}</Text>{opinion?.score != null ? <StarRatingDisplay rating={opinion.score} size={13} /> : null}</View>
        </ImageBackground>
      </Pressable>;
    })}
    </ScrollView>
    {status === 'loading' ? <Text style={styles.meta}>Loading activity…</Text> : status === 'error' ? <Text style={styles.meta}>Activity could not load. Open history to retry.</Text> : data?.items.length === 0 ? <Text style={styles.meta}>{owner ? 'Your next viewing will appear here.' : 'No viewings yet.'}</Text> : null}
  </View>;
}

const styles = StyleSheet.create({
  section: { gap: spacing.xs }, headingRow: { flexDirection: 'row', alignItems: 'center' }, rail: { gap: spacing.md }, header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heading: { color: colors.text, fontSize: 22, fontWeight: '700' }, link: { minHeight: 44, justifyContent: 'center', paddingLeft: spacing.md },
  linkText: { ...typography.meta, color: colors.accentText }, visibility: { width: 36, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  row: { width: 210, height: 118, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.panelElevated, overflow: 'hidden' },
  reducedArtwork: { width: '85%', height: '150%', left: '7.5%', top: '-25%' },
  artwork: { flex: 1, justifyContent: 'flex-end' }, copy: { padding: spacing.sm, gap: 4 },
  cardMeta: { fontSize: 11, lineHeight: 15, fontWeight: '600', color: colors.textMuted },
  title: { color: colors.text, fontSize: 16, fontWeight: '700' }, meta: { ...typography.meta, color: colors.textSubtle },
});
