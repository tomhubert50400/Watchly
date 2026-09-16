import { Camera } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { apiPut } from '../api/client';
import { PersonalWatchlistItem } from '../api/watchlists';
import { useAuthSession } from '../auth/AuthSessionContext';
import { useCatalogueCache } from '../catalogue/CatalogueCacheContext';
import { BottomActionSheet, BottomActionSheetScrollView } from '../components/BottomActionSheet';
import { Button } from '../components/Button';
import { InlineStatusBanner } from '../components/InlineStatusBanner';
import { MediaPoster } from '../components/MediaPoster';
import { colors, radii, spacing, typography } from '../design/tokens';
import { BlendedArtwork } from '../library/WatchlistRail';
import { notifyUserDataChanged } from '../sync/userDataEvents';
import { getWatchlistCoverItems, toggleWatchlistCoverItem } from './watchlistCover';

type Props = {
  coverItemIds?: string[];
  items: PersonalWatchlistItem[];
  kind: 'personal' | 'shared';
  onSaved: (ids: string[]) => void;
  watchlistId: string;
};
type Artwork = { artworkUrl: string | null; title: string };

export function WatchlistCoverButton(props: Props) {
  const [open, setOpen] = useState(false);
  return <>
    <Pressable accessibilityLabel="Change watchlist cover" accessibilityRole="button"
      onPress={() => setOpen(true)} style={({ pressed }) => [styles.headerButton, pressed && styles.pressed]}>
      <Camera color={colors.text} size={20} strokeWidth={2} />
    </Pressable>
    {open ? <WatchlistCoverSheet {...props} onClose={() => setOpen(false)} /> : null}
  </>;
}

function WatchlistCoverSheet({ coverItemIds = [], items, kind, onClose, onSaved, watchlistId }: Props & { onClose: () => void }) {
  const { currentUser, getFirebaseIdToken } = useAuthSession();
  const { refreshMovie, refreshSeries } = useCatalogueCache();
  const [selected, setSelected] = useState(() => coverItemIds.filter((id) => items.some((item) => item.id === id)));
  const [artwork, setArtwork] = useState<Record<string, Artwork>>({});
  const [visibleCount, setVisibleCount] = useState(24);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const alive = useRef(true);
  const ownerRef = useRef(currentUser?.id);
  ownerRef.current = currentUser?.id;
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const visible = items.slice(0, visibleCount);
    const candidates = [...new Map([...visible, ...getWatchlistCoverItems(items, coverItemIds)].map((item) => [item.id, item])).values()];
    async function load() {
      setLoading(true);
      // Keep long lists bounded while allowing every title to be reached.
      for (let index = 0; index < candidates.length; index += 6) {
        if (cancelled) return;
        const results = await Promise.all(candidates.slice(index, index + 6).map(async (item) => {
          try {
            const media = item.contentType === 'movie' ? await refreshMovie(item.tmdbId) : await refreshSeries(item.tmdbId);
            return [item.id, { artworkUrl: media.backdropUrl ?? media.posterUrl, title: media.title }] as const;
          } catch {
            return [item.id, { artworkUrl: null, title: 'Title unavailable' }] as const;
          }
        }));
        if (cancelled) return;
        setArtwork((previous) => ({ ...previous, ...Object.fromEntries(results) }));
      }
      if (!cancelled) setLoading(false);
    }
    void load();
    return () => { cancelled = true; };
  }, [items, visibleCount, refreshMovie, refreshSeries, retry]);

  async function save() {
    if (saving) return;
    const ownerId = ownerRef.current;
    setSaving(true);
    setError(null);
    try {
      const token = await getFirebaseIdToken();
      if (!alive.current) return;
      if (!token || !ownerId || ownerRef.current !== ownerId) throw new Error('Sign in again to change the cover.');
      const result = await apiPut<{ coverItemIds: string[] }>(
        `/${kind === 'personal' ? 'watchlists' : 'shared-watchlists'}/${watchlistId}/cover`,
        { itemIds: selected }, { token },
      );
      if (ownerRef.current !== ownerId) return;
      notifyUserDataChanged('watchlists');
      if (alive.current) {
        onSaved(result.coverItemIds);
        onClose();
      }
    } catch (failure) {
      if (alive.current) setError(failure instanceof Error ? failure.message : 'Could not save the cover.');
    } finally {
      if (alive.current) setSaving(false);
    }
  }

  const preview = getWatchlistCoverItems(items, selected).map((item) => artwork[item.id]?.artworkUrl ?? null);
  const unavailable = items.slice(0, visibleCount).some((item) => artwork[item.id]?.title === 'Title unavailable');
  return <BottomActionSheet visible title="Watchlist cover" onClose={onClose}
    footer={<Button fullWidth label="Save cover" loading={saving} onPress={() => void save()} />}>
    <BottomActionSheetScrollView contentContainerStyle={styles.content}>
      <View accessibilityLabel="Cover preview" style={styles.preview}>
        <BlendedArtwork blendId={`cover-preview-${watchlistId}`} urls={preview} />
      </View>
      <Text style={styles.copy}>Choose up to 4 images. {selected.length}/4 selected.</Text>
      {selected.length === 4 ? <Text style={styles.copy}>Deselect a title to choose another.</Text> : null}
      {error ? <InlineStatusBanner detail={error} tone="error" /> : null}
      {items.length === 0 ? <Text style={styles.copy}>Add films or series to this watchlist to choose its cover.</Text> : null}
      <View style={styles.grid}>
        {items.slice(0, visibleCount).map((item) => {
          const media = artwork[item.id];
          const position = selected.indexOf(item.id);
          const disabled = saving || (position < 0 && (selected.length === 4 || !media?.artworkUrl));
          return <Pressable key={item.id} accessibilityRole="checkbox"
            accessibilityLabel={media?.title ?? 'Loading title'} accessibilityState={{ checked: position >= 0, disabled }}
            disabled={disabled} onPress={() => setSelected((previous) => toggleWatchlistCoverItem(previous, item.id))}
            style={[styles.tile, disabled && position < 0 && styles.dimmed]}>
            <View style={[styles.posterFrame, position >= 0 && styles.selected]}>
              <MediaPoster posterUrl={media?.artworkUrl ?? null} style={styles.poster} />
              {position >= 0 ? <View style={styles.badge}><Text style={styles.badgeText}>{position + 1}</Text></View> : null}
            </View>
          </Pressable>;
        })}
      </View>
      {loading ? <Text style={styles.copy}>Loading images…</Text> : null}
      {unavailable && !loading ? <Button label="Retry unavailable titles" variant="ghost" onPress={() => setRetry((value) => value + 1)} /> : null}
      {visibleCount < items.length ? <Button label="Show more titles" variant="secondary" disabled={loading} onPress={() => setVisibleCount((count) => count + 24)} /> : null}
      <Button label="Use automatic cover" variant="ghost" disabled={saving || selected.length === 0} onPress={() => setSelected([])} />
    </BottomActionSheetScrollView>
  </BottomActionSheet>;
}

const styles = StyleSheet.create({
  headerButton: { width: 44, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.7 },
  content: { padding: spacing.xl, gap: spacing.md },
  preview: { width: '100%', aspectRatio: 278 / 156, overflow: 'hidden', borderRadius: radii.lg, backgroundColor: colors.panelElevated },
  copy: { ...typography.body, color: colors.textMuted },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tile: { width: '48%', gap: spacing.xs },
  posterFrame: { borderRadius: radii.md, borderWidth: 2, borderColor: 'transparent', overflow: 'hidden' },
  selected: { borderColor: colors.accent },
  poster: { width: '100%', aspectRatio: 16 / 9 },
  badge: { position: 'absolute', top: 6, right: 6, width: 26, height: 26, borderRadius: 13, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: colors.textOnAccent, fontWeight: '800' },
  dimmed: { opacity: 0.45 },
});
