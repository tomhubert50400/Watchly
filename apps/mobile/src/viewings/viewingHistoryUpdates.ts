import { useSyncExternalStore } from 'react';
import type { JournalViewing, ViewingHistoryItem, ViewingTarget } from '../api/viewings';
import { getMemoryResource, setMemoryResource } from '../cache/memoryResourceCache';

export type ViewingHistoryUpdate = { target: ViewingTarget; history: ViewingHistoryItem[]; title?: string; pending: boolean };
const listeners = new Set<() => void>();
let revision = 0;
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
const snapshot = () => revision;
export const useViewingHistoryUpdates = () => useSyncExternalStore(subscribe, snapshot, snapshot);
const cacheKey = (userId: string) => `watchly:user:${userId}:viewing-history-updates`;
export const viewingTargetKey = (target: ViewingTarget) => target.contentType === 'movie'
  ? `movie:${target.tmdbId}` : `episode:${target.tmdbId}:${target.seasonNumber}:${target.episodeNumber}`;

export function getViewingHistoryUpdates(userId: string): ViewingHistoryUpdate[] {
  return getMemoryResource<ViewingHistoryUpdate[]>(cacheKey(userId))?.data ?? [];
}

export function setViewingHistoryUpdate(userId: string, target: ViewingTarget, update: ViewingHistoryUpdate | null) {
  const updates = getViewingHistoryUpdates(userId).filter((item) => viewingTargetKey(item.target) !== viewingTargetKey(target));
  if (update) updates.push(update);
  setMemoryResource(cacheKey(userId), updates, new Date().toISOString());
  revision += 1;
  listeners.forEach((listener) => listener());
}

export function applyViewingHistoryUpdates(viewings: JournalViewing[], updates: ViewingHistoryUpdate[]) {
  return updates.reduce((items, update) => [
    ...items.filter((item) => !matchesViewingTarget(item, update.target)),
    ...update.history.flatMap((item): JournalViewing[] => item.watchedAt ? [{
      ...item, watchedAt: item.watchedAt, contentType: update.target.contentType, tmdbId: update.target.tmdbId,
      seasonNumber: update.target.contentType === 'episode' ? update.target.seasonNumber : null,
      episodeNumber: update.target.contentType === 'episode' ? update.target.episodeNumber : null,
    }] : []),
  ], viewings);
}

export function reconcileViewingHistoryUpdates(userId: string, viewings: JournalViewing[]) {
  getViewingHistoryUpdates(userId).forEach((update) => {
    if (update.pending) return;
    const items = viewings.filter((item) => matchesViewingTarget(item, update.target));
    if (items.length === update.history.length && update.history.every((item) => items.some((row) => row.id === item.id && row.watchedAt === item.watchedAt))) {
      setViewingHistoryUpdate(userId, update.target, null);
    }
  });
}

function matchesViewingTarget(item: JournalViewing, target: ViewingTarget) {
  return item.contentType === target.contentType && item.tmdbId === target.tmdbId &&
    (target.contentType === 'movie' || (item.seasonNumber === target.seasonNumber && item.episodeNumber === target.episodeNumber));
}
