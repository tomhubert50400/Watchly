import { apiDelete, apiGet, apiPut } from './client';

export type EpisodeProgress = {
  episodeNumber: number;
  id: string;
  seasonNumber: number;
  seriesTmdbId: number;
  updatedAt: string;
  watchedAt: string;
};

export type SeasonProgress = {
  episodes: EpisodeProgress[];
  seasonNumber: number;
  seriesTmdbId: number;
  watchedEpisodeCount: number;
};

export type SeriesProgress = {
  episodes: EpisodeProgress[];
  seriesTmdbId: number;
  watchedEpisodeCount: number;
};

export type SeriesProgressSummary = {
  latestEpisodeNumber: number;
  latestSeasonNumber: number;
  seriesTmdbId: number;
  updatedAt: string;
  watchedEpisodeCount: number;
};

export type SeriesProgressSummariesResponse = {
  items: SeriesProgressSummary[];
};

function episodeProgressPath(seriesTmdbId: number, seasonNumber: number, episodeNumber: number) {
  return `/progress/episodes/${seriesTmdbId}/seasons/${seasonNumber}/episodes/${episodeNumber}`;
}

export function getEpisodeProgress(
  token: string,
  seriesTmdbId: number,
  seasonNumber: number,
  episodeNumber: number,
) {
  return apiGet<EpisodeProgress | null>(
    episodeProgressPath(seriesTmdbId, seasonNumber, episodeNumber),
    { token },
  );
}

export function listSeasonProgress(token: string, seriesTmdbId: number, seasonNumber: number) {
  return apiGet<SeasonProgress>(`/progress/episodes/${seriesTmdbId}/seasons/${seasonNumber}`, { token });
}

export function listSeriesProgress(token: string, seriesTmdbId: number) {
  return apiGet<SeriesProgress>(`/progress/episodes/${seriesTmdbId}`, { token });
}

export function listSeriesProgressSummaries(token: string) {
  return apiGet<SeriesProgressSummariesResponse>('/progress/series', { token });
}

export function markEpisodeWatched(
  token: string,
  seriesTmdbId: number,
  seasonNumber: number,
  episodeNumber: number,
) {
  return apiPut<EpisodeProgress>(episodeProgressPath(seriesTmdbId, seasonNumber, episodeNumber), {}, { token });
}

export function clearEpisodeProgress(
  token: string,
  seriesTmdbId: number,
  seasonNumber: number,
  episodeNumber: number,
) {
  return apiDelete<{ deleted: true }>(episodeProgressPath(seriesTmdbId, seasonNumber, episodeNumber), { token });
}
