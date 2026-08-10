import { apiGet, apiPost } from './client';

export type ViewingStats = {
  highlights: Array<{
    artworkUrl: string | null;
    contentType: 'movie' | 'series';
    minutes: number;
    title: string;
    tmdbId: number;
    views: number;
  }>;
  more: {
    averageRating: number | null;
    favoriteWatchDay: string | null;
    mostUsedRating: number | null;
    ratingCount: number;
    rewatchCount: number;
  };
  summary: {
    episodeCount: number;
    movieCount: number;
    seriesCount: number;
    totalViewCount: number;
    watchMinutes: number;
    watchTimeIsEstimated: boolean;
  };
  taste: Array<{
    count: number;
    genre: string;
  }>;
};

export type MovieViewingSummary = {
  tmdbId: number;
  viewCount: number;
};

export type EpisodeViewingSummary = {
  episodeNumber: number;
  seasonNumber: number;
  seriesTmdbId: number;
  viewCount: number;
};

export type SeriesViewingSummary = {
  rewatchCount: number;
  seriesTmdbId: number;
  totalViewCount: number;
  watchedEpisodeCount: number;
};

export function getViewingStats(token: string) {
  return apiGet<ViewingStats>('/viewings/stats', { token, timeoutMs: 30_000 });
}

export function getMovieViewingSummary(token: string, tmdbId: number) {
  return apiGet<MovieViewingSummary>(`/viewings/movies/${tmdbId}`, { token });
}

export function logMovieViewing(token: string, tmdbId: number) {
  return apiPost<MovieViewingSummary>(`/viewings/movies/${tmdbId}`, {}, { token });
}

export function getSeriesViewingSummary(token: string, seriesTmdbId: number) {
  return apiGet<SeriesViewingSummary>(`/viewings/series/${seriesTmdbId}`, { token });
}

export function getEpisodeViewingSummary(
  token: string,
  seriesTmdbId: number,
  seasonNumber: number,
  episodeNumber: number,
) {
  return apiGet<EpisodeViewingSummary>(
    `/viewings/episodes/${seriesTmdbId}/seasons/${seasonNumber}/episodes/${episodeNumber}`,
    { token },
  );
}

export function logEpisodeViewing(
  token: string,
  seriesTmdbId: number,
  seasonNumber: number,
  episodeNumber: number,
) {
  return apiPost<EpisodeViewingSummary>(
    `/viewings/episodes/${seriesTmdbId}/seasons/${seasonNumber}/episodes/${episodeNumber}`,
    {},
    { token },
  );
}
