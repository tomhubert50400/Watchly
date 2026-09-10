import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { CharacterAlert, listCharacterAlerts, setCharacterAlert } from '../api/characterAlerts';
import { useAuthSession } from '../auth/AuthSessionContext';
import { Button } from '../components/Button';
import { colors, radii, spacing, typography } from '../design/tokens';
import { notifyUserDataChanged } from '../sync/userDataEvents';
import { maybeEnableReleasePushFromAlert } from './nativePushNotifications';
import { useToast } from './ToastContext';

export function CharacterAlertsPanel({ contentType, tmdbId }: { contentType?: 'movie' | 'series'; tmdbId?: number }) {
  const { currentUser, getFirebaseIdToken } = useAuthSession();
  const { showToast } = useToast();
  const [items, setItems] = useState<CharacterAlert[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [saving, setSaving] = useState<string | null>(null);
  const scope = `${currentUser?.id ?? ''}:${contentType ?? ''}:${tmdbId ?? ''}`;
  const [loadedScope, setLoadedScope] = useState(scope);
  const scopeRef = useRef(scope);
  scopeRef.current = scope;
  const requestVersion = useRef(0);
  const mutationPending = useRef(false);

  const load = useCallback(async () => {
    const version = ++requestVersion.current;
    setStatus('loading');
    setItems([]);
    if (!currentUser) return;
    try {
      const token = await getFirebaseIdToken();
      if (!token) throw new Error('Sign in again to load character alerts.');
      const result = await listCharacterAlerts(token, contentType && tmdbId ? { contentType, tmdbId } : undefined);
      if (scopeRef.current !== scope || requestVersion.current !== version) return;
      setLoadedScope(scope);
      setItems(result.items);
      setStatus('ready');
    } catch {
      if (scopeRef.current === scope && requestVersion.current === version) setStatus('error');
    }
  }, [contentType, currentUser?.id, getFirebaseIdToken, scope, tmdbId]);

  useFocusEffect(useCallback(() => {
    void load();
    return () => { requestVersion.current += 1; };
  }, [load]));

  async function toggle(item: CharacterAlert) {
    if (!currentUser || mutationPending.current) return;
    mutationPending.current = true;
    setSaving(item.key);
    try {
      const token = await getFirebaseIdToken();
      if (!token) throw new Error('Sign in again to update character alerts.');
      if (scopeRef.current !== scope) return;
      const enabled = !item.enabled;
      let permissionMessage: string | undefined;
      if (enabled) {
        const result = await maybeEnableReleasePushFromAlert(token, currentUser.id).catch(() => ({
          message: 'System notifications could not be enabled. Your in-app alert still works.',
        }));
        permissionMessage = result.message;
      }
      if (scopeRef.current !== scope) return;
      const result = await setCharacterAlert(token, item.key, enabled);
      if (scopeRef.current !== scope) return;
      setItems((current) => current.map((entry) => entry.key === item.key ? { ...entry, enabled: result.enabled } : entry));
      notifyUserDataChanged('releaseAlerts');
      if (permissionMessage) showToast(permissionMessage);
    } catch {
      if (scopeRef.current === scope) showToast('Could not update character alerts. Try again.');
    } finally {
      mutationPending.current = false;
      setSaving(null);
    }
  }

  const visibleItems = loadedScope === scope ? items : [];
  if (contentType && (status === 'loading' || loadedScope !== scope)) return null;
  if (!currentUser || (status === 'ready' && loadedScope === scope && items.length === 0)) return null;

  return (
    <View style={styles.section}>
      <Text style={styles.heading}>Follow characters</Text>
      <Text style={styles.description}>
        Get a reminder one week before a verified appearance. Follows stay within the named continuity, even when the actor changes.
      </Text>
      {status === 'loading' ? <Text style={styles.description}>Loading characters…</Text> : null}
      {status === 'error' ? <Button label="Retry character alerts" onPress={() => void load()} variant="secondary" /> : null}
      {visibleItems.map((item) => (
        <View key={item.key} style={styles.row}>
          <View style={styles.copy}>
            <Text style={styles.name}>{item.name}</Text>
            <Text style={styles.description}>{item.continuity}</Text>
          </View>
          <Button
            accessibilityLabel={`${item.enabled ? 'Unfollow' : 'Follow'} ${item.name}, ${item.continuity}`}
            compact
            disabled={saving !== null}
            label={saving === item.key ? 'Saving…' : item.enabled ? 'Unfollow' : 'Follow'}
            onPress={() => void toggle(item)}
            variant="secondary"
          />
        </View>
      ))}
      {status === 'ready' ? <Text style={styles.description}>Not every character is available yet.</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm },
  heading: { ...typography.title, color: colors.text },
  description: { ...typography.meta, color: colors.textMuted },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, backgroundColor: colors.panel, borderRadius: radii.md },
  copy: { flex: 1, minWidth: 0, gap: spacing.xs },
  name: { ...typography.body, color: colors.text, fontWeight: '700' },
});
