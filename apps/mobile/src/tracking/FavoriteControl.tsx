import { useEffect, useRef, useState } from 'react';
import { Star } from 'lucide-react-native';
import { Pressable, StyleSheet } from 'react-native';
import { getTrackingState, TrackedContentType, upsertTrackingState } from '../api/tracking';
import { useAuthSession } from '../auth/AuthSessionContext';
import { colors, touchTargets } from '../design/tokens';
import { hapticError, hapticSelection } from '../feedback/haptics';
import { useToast } from '../notifications/ToastContext';
import { notifyUserDataChanged, useUserDataRevision } from '../sync/userDataEvents';

type Props = { contentType: TrackedContentType; tmdbId: number };

export function FavoriteControl(props: Props) {
  const { currentUser } = useAuthSession();
  return currentUser ? <FavoriteButton key={`${currentUser.id}:${props.contentType}:${props.tmdbId}`} {...props} /> : null;
}

function FavoriteButton({ contentType, tmdbId }: Props) {
  const { getFirebaseIdToken } = useAuthSession();
  const { showToast } = useToast();
  const revision = useUserDataRevision('tracking');
  const [favorite, setFavorite] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const busy = useRef(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    if (saving) return;
    let active = true;
    void (async () => {
      try {
        const token = await getFirebaseIdToken();
        if (!token) return;
        const state = await getTrackingState(token, contentType, tmdbId);
        if (active && !busy.current) setFavorite(state?.favorite ?? false);
      } catch {
        // A press reads the current state again before changing it.
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [contentType, getFirebaseIdToken, revision, saving, tmdbId]);

  async function toggle() {
    if (busy.current || loading) return;
    busy.current = true;
    setSaving(true);
    const previous = favorite;
    setFavorite(!previous);
    hapticSelection();
    try {
      const token = await getFirebaseIdToken();
      if (!token) throw new Error('Sign in again to update your favorites.');
      const current = await getTrackingState(token, contentType, tmdbId);
      // The tracking endpoint expects both fields when removing a favorite.
      const saved = await upsertTrackingState(token, {
        contentType,
        tmdbId,
        status: current?.status ?? null,
        favorite: !(current?.favorite ?? false),
      });
      if (mounted.current) setFavorite(saved?.favorite ?? false);
      notifyUserDataChanged('tracking');
    } catch (error) {
      if (mounted.current) {
        setFavorite(previous);
        hapticError();
        showToast(error instanceof Error ? error.message : 'Could not update your favorites.');
      }
    } finally {
      busy.current = false;
      if (mounted.current) setSaving(false);
    }
  }

  return (
    <Pressable
      accessibilityLabel={favorite ? 'Remove from favorites' : 'Add to favorites'}
      accessibilityRole="button"
      accessibilityState={{ busy: loading || saving, disabled: loading || saving, selected: favorite }}
      disabled={loading || saving}
      hitSlop={{ top: 8, bottom: 8 }}
      onPress={() => void toggle()}
      style={({ pressed }) => [styles.button, (pressed || loading) && styles.dimmed]}
    >
      <Star color={favorite ? colors.accentText : colors.text} fill={favorite ? colors.accentText : 'transparent'} size={22} strokeWidth={1.8} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    alignSelf: 'stretch',
    justifyContent: 'center',
    width: touchTargets.min,
  },
  dimmed: { opacity: 0.55 },
});
