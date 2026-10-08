import { clearMemoryResourcesWithPrefix } from '../cache/memoryResourceCache';
import { getPrivateCacheKey, removePersistedCache, removePersistedCachesWithPrefix } from '../cache/persistedCache';
import { notifyUserDataChanged } from '../sync/userDataEvents';
import { getViewingHistoryUpdates, setViewingHistoryUpdate } from '../viewings/viewingHistoryUpdates';

export const PROFILE_TITLE_REMOVAL_MESSAGE = 'This removes its status, favorite, ratings, reviews, viewing history and release alert, including its place in Planned to Watch. For a series, this also removes episode progress, ratings and reviews. It also clears this title as your profile background. Your custom and shared watchlists are kept. This cannot be undone.';

export async function refreshAfterProfileTitleRemoval(ownerId: string, contentType: 'movie' | 'series', tmdbId: number) {
  const keys = [
    'library:v6', 'profile:owner-activity:v9', 'profile:all-time:v2', 'progress-library:v3',
    `tracking:${contentType}:${tmdbId}`, `opinion:${contentType}:${tmdbId}`,
    `viewings:${contentType}:${tmdbId}`, `release-alert:${contentType}:${tmdbId}`,
  ].map((key) => getPrivateCacheKey(ownerId, key));
  keys.slice(0, 4).forEach(clearMemoryResourcesWithPrefix);
  await Promise.all(keys.map((key) => removePersistedCache(key).catch(() => undefined)));
  if (contentType === 'series') {
    await Promise.all([`episodes:${tmdbId}:`, `opinion:episode:${tmdbId}:`, `viewings:episode:${tmdbId}:`].map(async (key) => {
      const prefix = getPrivateCacheKey(ownerId, key);
      clearMemoryResourcesWithPrefix(prefix);
      await removePersistedCachesWithPrefix(prefix).catch(() => undefined);
    }));
  }
  for (const update of getViewingHistoryUpdates(ownerId)) {
    if (update.target.tmdbId === tmdbId && update.target.contentType === (contentType === 'movie' ? 'movie' : 'episode')) {
      setViewingHistoryUpdate(ownerId, update.target, null);
    }
  }
  notifyUserDataChanged('tracking', 'episodeProgress', 'opinions', 'viewings', 'releaseAlerts', 'profile', 'feed', 'watchlists');
}
