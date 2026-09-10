import { useCallback, useEffect, useRef, useState } from 'react';
import { useRoute, type RouteProp } from '@react-navigation/native';
import { AccessibilityInfo, StyleSheet, Text, View } from 'react-native';
import { getActor } from '../api/catalogue';
import { useCachedResource } from '../cache/useCachedResource';
import { getPublicCacheKey } from '../cache/persistedCache';
import { ScreenReveal } from '../components/ScreenReveal';
import { Button } from '../components/Button';
import { EmptyState } from '../components/EmptyState';
import { LoadingState } from '../components/LoadingState';
import { Screen } from '../components/Screen';
import { UserAvatar } from '../components/UserAvatar';
import { colors, spacing, typography } from '../design/tokens';
import type { RootStackParamList } from '../navigation/types';
import { ActorFilmography } from './ActorFilmography';

export function ActorDetailScreen() {
  const { params } = useRoute<RouteProp<RootStackParamList, 'ActorDetail'>>();
  const load = useCallback(() => getActor(params.tmdbId), [params.tmdbId]);
  const resource = useCachedResource({ key: getPublicCacheKey(`actor:${params.tmdbId}`), load });
  const actor = resource.data?.item;
  const biography = actor?.biography.trim() ?? '';
  return (
    <Screen contentReady={Boolean(actor)} safeAreaEdges={[]} title={actor?.name ?? params.name}>
      {!actor && resource.isInitialLoading ? <LoadingState variant="profile" label="Loading actor" /> : null}
      {!actor && resource.error ? <EmptyState title="Could not load actor" body={resource.error}><Button label="Retry" onPress={resource.retry} /></EmptyState> : null}
      {actor ? <View style={styles.content}>
        <ScreenReveal delay={50}><UserAvatar avatarUrl={actor.profileUrl} displayName={actor.name} size={112} /></ScreenReveal>
        {actor.biography ? <ScreenReveal delay={100} style={styles.biography}>
          <ActorBiography key={biography} biography={biography} />
        </ScreenReveal> : null}
        <ActorFilmography key={actor.tmdbId} credits={actor.credits} />
      </View> : null}
    </Screen>
  );
}

function ActorBiography({ biography }: { biography: string }) {
  const canExpand = biography.length > 280;
  const preview = canExpand ? biography.slice(0, 280).replace(/\s+\S*$/, '').trimEnd() : biography;
  const [expanded, setExpanded] = useState(false);
  const [visibleLength, setVisibleLength] = useState(preview.length);
  const currentLength = useRef(preview.length);
  const [reduceMotion, setReduceMotion] = useState(true);

  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(value => {
      if (active) setReduceMotion(value);
    }, () => {});
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => { active = false; subscription.remove(); };
  }, []);

  useEffect(() => {
    const target = expanded ? biography.length : preview.length;
    const start = currentLength.current;
    if (reduceMotion || start === target) {
      currentLength.current = target;
      setVisibleLength(target);
      return;
    }
    const startedAt = performance.now();
    let frame: number;
    const tick = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / 600);
      const length = Math.round(start + (target - start) * progress);
      currentLength.current = length;
      setVisibleLength(length);
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [biography, expanded, preview.length, reduceMotion]);

  return <Text style={styles.body}>
    {biography.slice(0, visibleLength)}{visibleLength < biography.length ? '…' : ''}
    {canExpand ? <Text
      accessibilityRole="button"
      accessibilityState={{ expanded }}
      onPress={() => setExpanded(value => !value)}
      style={styles.readMore}
    >{expanded ? ' Read less' : ' Read more'}</Text> : null}
  </Text>;
}

const styles = StyleSheet.create({
  content: { gap: spacing.lg },
  biography: { gap: spacing.sm },
  body: { ...typography.body, color: colors.textMuted },
  readMore: { color: colors.accentText, fontWeight: '700' },
});
