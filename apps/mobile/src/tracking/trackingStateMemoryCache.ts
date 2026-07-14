export type TrackingStateMemoryCache<T> = {
  clearUser: (userId: string) => void;
  get: (userId: string, contentType: string, tmdbId: number) => T | undefined;
  has: (userId: string, contentType: string, tmdbId: number) => boolean;
  set: (userId: string, contentType: string, tmdbId: number, value: T) => void;
  size: () => number;
};

export function createTrackingStateMemoryCache<T>(limit: number): TrackingStateMemoryCache<T> {
  if (!Number.isInteger(limit) || limit < 1) throw new Error('Tracking cache limit must be positive.');
  const entries = new Map<string, { ownerId: string; value: T }>();
  const keyFor = (userId: string, contentType: string, tmdbId: number) =>
    JSON.stringify([userId, contentType, tmdbId]);

  return {
    clearUser: (userId) => {
      for (const [key, entry] of entries) {
        if (entry.ownerId === userId) entries.delete(key);
      }
    },
    get: (userId, contentType, tmdbId) => {
      const key = keyFor(userId, contentType, tmdbId);
      const entry = entries.get(key);
      if (!entry) return undefined;
      entries.delete(key);
      entries.set(key, entry);
      return entry.value;
    },
    has: (userId, contentType, tmdbId) => entries.has(keyFor(userId, contentType, tmdbId)),
    set: (userId, contentType, tmdbId, value) => {
      const key = keyFor(userId, contentType, tmdbId);
      entries.delete(key);
      entries.set(key, { ownerId: userId, value });
      while (entries.size > limit) {
        const oldest = entries.keys().next().value;
        if (oldest === undefined) break;
        entries.delete(oldest);
      }
    },
    size: () => entries.size,
  };
}
