import { apiDelete, apiGet, apiPut } from './client';

export type MovieReview = {
  body: string;
  id: string;
  tmdbId: number;
  updatedAt: string;
};

export type EpisodeReview = {
  body: string;
  episodeNumber: number;
  id: string;
  seasonNumber: number;
  seriesTmdbId: number;
  updatedAt: string;
};

export function getMovieReview(token: string, tmdbId: number) {
  return apiGet<MovieReview | null>(`/reviews/movies/${tmdbId}`, { token });
}

export function upsertMovieReview(token: string, tmdbId: number, body: string) {
  return apiPut<MovieReview>(`/reviews/movies/${tmdbId}`, { body }, { token });
}

export function deleteMovieReview(token: string, tmdbId: number) {
  return apiDelete<{ deleted: true }>(`/reviews/movies/${tmdbId}`, { token });
}

function episodeReviewPath(seriesTmdbId: number, seasonNumber: number, episodeNumber: number) {
  return `/reviews/episodes/${seriesTmdbId}/seasons/${seasonNumber}/episodes/${episodeNumber}`;
}

export function getEpisodeReview(
  token: string,
  seriesTmdbId: number,
  seasonNumber: number,
  episodeNumber: number,
) {
  return apiGet<EpisodeReview | null>(episodeReviewPath(seriesTmdbId, seasonNumber, episodeNumber), { token });
}

export function upsertEpisodeReview(
  token: string,
  seriesTmdbId: number,
  seasonNumber: number,
  episodeNumber: number,
  body: string,
) {
  return apiPut<EpisodeReview>(
    episodeReviewPath(seriesTmdbId, seasonNumber, episodeNumber),
    { body },
    { token },
  );
}

export function deleteEpisodeReview(
  token: string,
  seriesTmdbId: number,
  seasonNumber: number,
  episodeNumber: number,
) {
  return apiDelete<{ deleted: true }>(episodeReviewPath(seriesTmdbId, seasonNumber, episodeNumber), { token });
}
