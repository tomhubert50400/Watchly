import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { defaultSpoilerPreferences, parseSpoilerPreferences, type SpoilerPreferences } from './spoilerModel';

type Snapshot = { preferences: SpoilerPreferences; loaded: boolean; saving: boolean; error: string | null };
const initial: Snapshot = { preferences: defaultSpoilerPreferences, loaded: false, saving: false, error: null };
const snapshots = new Map<string, Snapshot>();
const listeners = new Set<() => void>();
const loading = new Set<string>();
const confirmed = new Map<string, SpoilerPreferences>();
const writes = new Map<string, Promise<void>>();
const keyFor = (userId: string) => `watchly:user:${userId}:community-spoilers:v1`;
const read = (userId: string) => snapshots.get(userId) ?? initial;
function publish(userId: string, snapshot: Snapshot) {
  snapshots.set(userId, snapshot);
  listeners.forEach((listener) => listener());
}
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };

export function useSpoilerPreferences(userId: string) {
  const snapshot = useSyncExternalStore(subscribe, useCallback(() => read(userId), [userId]));
  const load = useCallback(async () => {
    if (loading.has(userId)) return;
    loading.add(userId);
    try {
      const raw = await AsyncStorage.getItem(keyFor(userId));
      const preferences = parseSpoilerPreferences(raw ? JSON.parse(raw) : null);
      confirmed.set(userId, preferences);
      publish(userId, { preferences, loaded: true, saving: false, error: null });
    } catch {
      publish(userId, { ...read(userId), error: 'Could not load spoiler protection. Try again.' });
    } finally {
      loading.delete(userId);
    }
  }, [userId]);
  useEffect(() => { if (!read(userId).loaded) void load(); }, [load, userId]);
  const save = (patch: Partial<SpoilerPreferences>) => {
    const previous = read(userId);
    if (!previous.loaded) return Promise.resolve();
    const preferences = { ...previous.preferences, ...patch };
    publish(userId, { ...previous, preferences, saving: true, error: null });
    const write = (writes.get(userId) ?? Promise.resolve()).then(async () => {
      try {
        await AsyncStorage.setItem(keyFor(userId), JSON.stringify(preferences));
        confirmed.set(userId, preferences);
        if (read(userId).preferences === preferences) {
          publish(userId, { preferences, loaded: true, saving: false, error: null });
        }
      } catch {
        if (read(userId).preferences === preferences) {
          publish(userId, { preferences: confirmed.get(userId)!, loaded: true, saving: false, error: 'Could not save spoiler protection. Try again.' });
        }
      }
    });
    writes.set(userId, write);
    void write.then(() => { if (writes.get(userId) === write) writes.delete(userId); });
    return write;
  };
  return { ...snapshot, save, retry: load };
}
