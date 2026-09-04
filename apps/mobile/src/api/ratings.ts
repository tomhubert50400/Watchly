import { apiDelete, apiGet, apiPut } from './client';

export type MovieRating = {
  id: string;
  score: number;
  tmdbId: number;
  updatedAt: string;
};

export type EpisodeRating = {
  episodeNumber: number;
  id: string;
  score: number;
  seasonNumber: number;
  seriesTmdbId: number;
  updatedAt: string;
};

export type SeriesRatingSummary = {
  averageScore: number | null;
  ratedEpisodeCount: number;
  seasons: {
    averageScore: number | null;
    ratedEpisodeCount: number;
    seasonNumber: number;
  }[];
  seriesTmdbId: number;
};

export type SeriesRating = {
  id: string;
  score: number;
  seriesTmdbId: number;
  updatedAt: string;
};

export function listMovieRatings(token: string) {
  return apiGet<MovieRating[]>('/ratings/movies', { token });
}

export function getMovieRating(token: string, tmdbId: number) {
  return apiGet<MovieRating | null>(`/ratings/movies/${tmdbId}`, { token });
}

export function upsertMovieRating(token: string, tmdbId: number, score: number) {
  return apiPut<MovieRating>(`/ratings/movies/${tmdbId}`, { score }, { token });
}

export function deleteMovieRating(token: string, tmdbId: number) {
  return apiDelete<{ deleted: true }>(`/ratings/movies/${tmdbId}`, { token });
}

function episodeRatingPath(seriesTmdbId: number, seasonNumber: number, episodeNumber: number) {
  return `/ratings/episodes/${seriesTmdbId}/seasons/${seasonNumber}/episodes/${episodeNumber}`;
}

export function getEpisodeRating(
  token: string,
  seriesTmdbId: number,
  seasonNumber: number,
  episodeNumber: number,
) {
  return apiGet<EpisodeRating | null>(episodeRatingPath(seriesTmdbId, seasonNumber, episodeNumber), { token });
}

export function upsertEpisodeRating(
  token: string,
  seriesTmdbId: number,
  seasonNumber: number,
  episodeNumber: number,
  score: number,
) {
  return apiPut<EpisodeRating>(
    episodeRatingPath(seriesTmdbId, seasonNumber, episodeNumber),
    { score },
    { token },
  );
}

export function deleteEpisodeRating(
  token: string,
  seriesTmdbId: number,
  seasonNumber: number,
  episodeNumber: number,
) {
  return apiDelete<{ deleted: true }>(episodeRatingPath(seriesTmdbId, seasonNumber, episodeNumber), { token });
}

export function getSeriesRating(token: string, seriesTmdbId: number) {
  return apiGet<SeriesRating | null>(`/ratings/series/${seriesTmdbId}`, { token });
}

export function upsertSeriesRating(token: string, seriesTmdbId: number, score: number) {
  return apiPut<SeriesRating>(`/ratings/series/${seriesTmdbId}`, { score }, { token });
}

export function deleteSeriesRating(token: string, seriesTmdbId: number) {
  return apiDelete<{ deleted: true }>(`/ratings/series/${seriesTmdbId}`, { token });
}

export function getSeriesRatingSummary(token: string, seriesTmdbId: number) {
  return apiGet<SeriesRatingSummary>(`/ratings/series/${seriesTmdbId}/summary`, { token });
}
