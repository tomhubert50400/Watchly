export type SpoilerPreferences = {
  enabled: boolean;
  unwatchedEpisodes: boolean;
  unwatchedMovies: boolean;
  watchlist: boolean;
  recentDays: 0 | 3 | 7 | 14;
};

export const defaultSpoilerPreferences: SpoilerPreferences = {
  enabled: false, unwatchedEpisodes: true, unwatchedMovies: false, watchlist: false, recentDays: 3,
};

export function parseSpoilerPreferences(value: unknown): SpoilerPreferences {
  const input = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  return {
    enabled: input.enabled === true,
    unwatchedEpisodes: typeof input.unwatchedEpisodes === 'boolean' ? input.unwatchedEpisodes : true,
    unwatchedMovies: input.unwatchedMovies === true,
    watchlist: input.watchlist === true,
    recentDays: input.recentDays === 0 || input.recentDays === 7 || input.recentDays === 14 ? input.recentDays : 3,
  };
}

export function spoilerReason(preferences: SpoilerPreferences, item: {
  content: { contentType: 'movie' | 'episode' | 'series' };
  viewerHasWatched: boolean;
  inWatchlist: boolean;
  releaseDate: string | null;
}, now = new Date()) {
  if (!preferences.enabled) return null;
  if (preferences.unwatchedEpisodes && item.content.contentType === 'episode' && !item.viewerHasWatched) return 'Episode not watched yet';
  if (preferences.unwatchedMovies && item.content.contentType === 'movie' && !item.viewerHasWatched) return 'Movie not watched yet';
  if (preferences.watchlist && item.inWatchlist && !item.viewerHasWatched) return 'Still on your watchlist';
  if (preferences.recentDays > 0) {
    const date = item.releaseDate ? Date.parse(item.releaseDate) : NaN;
    if (!Number.isFinite(date)) return 'Release date unavailable';
    if (date > now.getTime()) return 'Not released yet';
    if (now.getTime() - date < preferences.recentDays * 86400000) return `Released less than ${preferences.recentDays} days ago`;
  }
  return null;
}
