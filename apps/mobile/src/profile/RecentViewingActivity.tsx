import { useCallback, useState } from 'react';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { getProfileHistory, type ProfileHistory } from '../api/profile';
import { ApiError } from '../api/client';
import { useAuthSession } from '../auth/AuthSessionContext';
import { MediaPoster } from '../components/MediaPoster';
import { StarRatingDisplay } from '../components/StarRatingDisplay';
import { colors, spacing, typography } from '../design/tokens';
import type { RootStackParamList } from '../navigation/types';
import { useUserDataRevision } from '../sync/userDataEvents';

export function RecentViewingActivity({ userId, owner = false }: { userId: string; owner?: boolean }) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { currentUser, getFirebaseIdToken } = useAuthSession();
  const revision = useUserDataRevision('viewings', 'opinions', 'episodeProgress');
  const [data, setData] = useState<ProfileHistory | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'private' | 'error'>('loading');
  useFocusEffect(useCallback(() => {
    let active = true;
    setData(null);
    setStatus('loading');
    void (async () => {
      try {
        const token = await getFirebaseIdToken();
        if (!token) throw new Error('Sign in to view activity.');
        const result = await getProfileHistory(token, userId, true);
        if (active) { setData(result); setStatus('ready'); }
      } catch (error) {
        if (active) setStatus(error instanceof ApiError && (error.status === 403 || error.status === 404) ? 'private' : 'error');
      }
    })();
    return () => { active = false; };
  }, [currentUser?.id, getFirebaseIdToken, userId, revision]));
  if (!owner && (status === 'private' || (data && data.visibility !== 'public'))) return null;
  return <View style={styles.section}>
    <View style={styles.header}>
      <Text style={styles.heading}>Recent activity</Text>
      {owner || status === 'ready' || status === 'error' ? <Pressable accessibilityRole="button" onPress={() => navigation.navigate('Journal', owner ? undefined : { userId })} style={styles.link}><Text style={styles.linkText}>View history</Text></Pressable> : null}
    </View>
    {owner && data ? <Pressable accessibilityRole="button" accessibilityLabel="Manage viewing history visibility" onPress={() => navigation.navigate('Settings')} style={styles.visibility}><Text style={styles.meta}>{data.visibility === 'public' ? 'Public history' : 'Private history'} · Manage</Text></Pressable> : null}
    {data?.items.map((item) => {
      const opinion = data.opinions.find((opinion) => {
        const content = opinion.content;
        return item.contentType === 'movie' ? content.contentType === 'movie' && content.tmdbId === item.tmdbId
          : content.contentType === 'episode' && content.seriesTmdbId === item.tmdbId && content.seasonNumber === item.seasonNumber && content.episodeNumber === item.episodeNumber;
      });
      const title = item.title ?? (item.contentType === 'movie' ? 'Movie' : 'Series');
      return <Pressable accessibilityRole="button" accessibilityLabel={`Open ${title}`} key={item.id} onPress={() => navigation.navigate(item.contentType === 'movie' ? 'FilmDetail' : 'SeriesDetail', { title, tmdbId: item.tmdbId })} style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}>
        <MediaPoster posterUrl={item.posterUrl} style={styles.poster} />
        <View style={styles.copy}><Text numberOfLines={1} style={styles.title}>{title}</Text><Text style={styles.meta}>{item.contentType === 'episode' ? `S${item.seasonNumber} E${item.episodeNumber} · ` : ''}{new Date(item.watchedAt).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })}</Text>{opinion?.score != null ? <StarRatingDisplay rating={opinion.score} size={13} /> : null}</View>
      </Pressable>;
    })}
    {status === 'loading' ? <Text style={styles.meta}>Loading activity…</Text> : status === 'error' ? <Text style={styles.meta}>Activity could not load. Open history to retry.</Text> : data?.items.length === 0 ? <Text style={styles.meta}>{owner ? 'Your next viewing will appear here.' : 'No viewings yet.'}</Text> : null}
  </View>;
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm }, header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heading: { color: colors.text, fontSize: 22, fontWeight: '700' }, link: { minHeight: 44, justifyContent: 'center', paddingLeft: spacing.md },
  linkText: { ...typography.meta, color: colors.accentText }, visibility: { minHeight: 44, justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm },
  poster: { width: 42, height: 63, borderRadius: 7 }, copy: { flex: 1, gap: 5 },
  title: { color: colors.text, fontSize: 16, fontWeight: '700' }, meta: { ...typography.meta, color: colors.textSubtle },
});
