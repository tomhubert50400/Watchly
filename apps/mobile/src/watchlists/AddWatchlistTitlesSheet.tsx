import { useEffect, useRef, useState } from 'react';
import { Keyboard } from 'react-native';
import { addWatchlistItem } from '../api/watchlists';
import { addSharedWatchlistItem } from '../api/sharedWatchlists';
import { useAuthSession } from '../auth/AuthSessionContext';
import { CatalogueTitlePicker, catalogueTitleKey } from '../catalogue/CatalogueTitlePicker';
import { BottomActionSheet, BottomActionSheetScrollView } from '../components/BottomActionSheet';
import { Button } from '../components/Button';
import { InlineStatusBanner } from '../components/InlineStatusBanner';
import { hapticSuccess } from '../feedback/haptics';
import { notifyUserDataChanged } from '../sync/userDataEvents';
import type { WatchlistDisplayItem } from './WatchlistDetailLayout';

export function AddWatchlistTitlesSheet({ kind, watchlistId, items, isPlanned = false, onClose }: {
  kind: 'personal' | 'shared'; watchlistId: string;
  isPlanned?: boolean;
  items: Pick<WatchlistDisplayItem, 'contentType' | 'tmdbId'>[]; onClose: () => void;
}) {
  const { currentUser, getFirebaseIdToken } = useAuthSession();
  const [selected, setSelected] = useState<WatchlistDisplayItem[]>([]);
  const [added, setAdded] = useState<WatchlistDisplayItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submitting = useRef(false);
  const active = useRef(true);
  const owner = useRef(currentUser?.id);
  owner.current = currentUser?.id;
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);

  async function save() {
    if (submitting.current || !selected.length || !owner.current) return;
    const expectedOwner = owner.current;
    const isCurrent = () => active.current && owner.current === expectedOwner;
    const existing = new Set([...items, ...added].map(catalogueTitleKey));
    const pending = selected.filter(item => !existing.has(catalogueTitleKey(item)));
    const saved: WatchlistDisplayItem[] = [];
    submitting.current = true;
    setSaving(true);
    setError(null);
    Keyboard.dismiss();
    try {
      const token = await getFirebaseIdToken();
      if (!isCurrent()) return;
      if (!token) throw new Error('Sign in again to add titles.');
      for (const item of pending) {
        if (!isCurrent()) return;
        try {
          await (kind === 'shared' ? addSharedWatchlistItem : addWatchlistItem)(token, watchlistId, {
            contentType: item.contentType, tmdbId: item.tmdbId,
          });
          saved.push(item);
        } catch {
          // Keep failed selections so retry only sends the titles still missing.
        }
      }
      if (!isCurrent()) return;
      const savedKeys = new Set(saved.map(catalogueTitleKey));
      const remaining = pending.filter(item => !savedKeys.has(catalogueTitleKey(item)));
      setAdded(current => [...current, ...saved]);
      setSelected(remaining);
      if (remaining.length) {
        setError(`${remaining.length} ${remaining.length === 1 ? 'title could' : 'titles could'} not be added.${saved.length ? ' Your other additions are saved.' : ''} Retry the remaining selection.`);
      } else {
        hapticSuccess();
        onClose();
      }
    } catch (cause) {
      if (isCurrent()) setError(cause instanceof Error ? cause.message : 'Titles could not be added.');
    } finally {
      submitting.current = false;
      if (isCurrent()) {
        setSaving(false);
        if (saved.length) notifyUserDataChanged('watchlists', ...(isPlanned ? ['tracking' as const] : []));
      }
    }
  }

  return <BottomActionSheet title="Add titles" visible onClose={() => { if (!submitting.current) onClose(); }}
    footer={<Button fullWidth label={`Add ${selected.length} ${selected.length === 1 ? 'title' : 'titles'}`}
      loading={saving} disabled={saving || !selected.length} onPress={() => void save()} />}>
    <BottomActionSheetScrollView keyboardShouldPersistTaps="always">
      {error ? <InlineStatusBanner tone="error" detail={error} /> : null}
      <CatalogueTitlePicker items={[]} selected={selected} onChange={setSelected} excluded={[...items, ...added]}
        label="Search titles to add" disabled={saving} selectionHint="Clear search to review your selection" />
    </BottomActionSheetScrollView>
  </BottomActionSheet>;
}
