import { useSyncExternalStore } from 'react';

type Title = { contentType: 'movie' | 'series'; tmdbId: number };
type Removal = Title & { ownerId: string; scope: string; profile: boolean; completedAt: number | null };
const removals = new Map<string, Removal>();
const listeners = new Set<() => void>();
let revision = 0;
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
const snapshot = () => revision;
function publish() { revision += 1; listeners.forEach((listener) => listener()); }

export const useTitleRemovalUpdates = () => useSyncExternalStore(subscribe, snapshot, snapshot);

export function beginTitleRemoval(ownerId: string, scope: string, title: Title, profile: boolean) {
  const key = JSON.stringify([ownerId, scope, title.contentType, title.tmdbId]);
  if (removals.get(key)?.completedAt === null) return null;
  const removal: Removal = { ...title, ownerId, scope, profile, completedAt: null };
  removals.set(key, removal);
  publish();
  return {
    commit() {
      if (removals.get(key) !== removal) return;
      removal.completedAt = Date.now();
      publish();
    },
    rollback() {
      if (removals.get(key) !== removal || removal.completedAt !== null) return;
      removals.delete(key);
      publish();
    },
  };
}

// A response begun before the deletion completed cannot bring its title back.
// Newer responses may contain a title intentionally added again by the user.
export function isTitleRemoved(ownerId: string | null | undefined, scope: string, title: Title, loadedAt = 0, isPlanned = false) {
  for (const removal of removals.values()) {
    if (removal.ownerId === ownerId && removal.contentType === title.contentType && removal.tmdbId === title.tmdbId
      && (removal.scope === scope || (removal.profile && (scope === 'profile' || isPlanned)))
      && (removal.completedAt === null || loadedAt <= removal.completedAt)) return true;
  }
  return false;
}
