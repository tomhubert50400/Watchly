import { apiGet } from './client';

export type CatalogueSearchType = 'all' | 'movie' | 'series';

export type CatalogueSearchItem = {
  id: string;
  mediaType: 'movie' | 'series';
  overview: string;
  posterUrl: string | null;
  releaseDate: string | null;
  title: string;
  tmdbId: number;
  voteAverage: number | null;
};

export type CatalogueSearchResponse = {
  items: CatalogueSearchItem[];
  provider: 'tmdb';
};

export type CatalogueMovieSectionsResponse = {
  announced: CatalogueSearchItem[];
  provider: 'tmdb';
  trending: CatalogueSearchItem[];
};

export type DisplayRating = {
  average: number;
  count: number | null;
  scale: 5 | 10;
  source: 'watchly' | 'tmdb';
};

export type MovieDetails = {
  backdropUrl: string | null;
  displayRating: DisplayRating | null;
  genres: string[];
  id: string;
  mediaType: 'movie';
  overview: string;
  posterUrl: string | null;
  releaseDate: string | null;
  runtimeMinutes: number | null;
  status: string | null;
  tagline: string | null;
  title: string;
  tmdbId: number;
  voteAverage: number | null;
};

export type MovieDetailsResponse = {
  item: MovieDetails;
  provider: 'tmdb';
};

export type SeriesDetails = {
  backdropUrl: string | null;
  firstAirDate: string | null;
  genres: string[];
  id: string;
  inProduction: boolean;
  mediaType: 'series';
  numberOfEpisodes: number | null;
  numberOfSeasons: number | null;
  overview: string;
  posterUrl: string | null;
  seasons: {
    airDate: string | null;
    episodeCount: number | null;
    id: string;
    name: string;
    posterUrl: string | null;
    seasonNumber: number;
  }[];
  status: string | null;
  tagline: string | null;
  title: string;
  tmdbId: number;
  voteAverage: number | null;
};

export type SeriesDetailsResponse = {
  item: SeriesDetails;
  provider: 'tmdb';
};

export type SeasonDetails = {
  airDate: string | null;
  episodes: {
    airDate: string | null;
    episodeNumber: number;
    id: string;
    overview: string;
    runtimeMinutes: number | null;
    seasonNumber: number;
    stillUrl: string | null;
    title: string;
    tmdbId: number;
    voteAverage: number | null;
  }[];
  id: string;
  mediaType: 'season';
  overview: string;
  posterUrl: string | null;
  seasonNumber: number;
  seriesTmdbId: number;
  title: string;
  tmdbId: number;
};

export type SeasonDetailsResponse = {
  item: SeasonDetails;
  provider: 'tmdb';
};

export type EpisodeDetails = {
  airDate: string | null;
  episodeNumber: number;
  id: string;
  mediaType: 'episode';
  overview: string;
  runtimeMinutes: number | null;
  seasonNumber: number;
  seriesTmdbId: number;
  stillUrl: string | null;
  title: string;
  tmdbId: number;
  voteAverage: number | null;
};

export type EpisodeDetailsResponse = {
  item: EpisodeDetails;
  provider: 'tmdb';
};

export type StreamingProvider = {
  id: number;
  logoUrl: string | null;
  name: string;
};

export type StreamingAvailability = {
  country: string;
  groups: {
    buy: StreamingProvider[];
    free: StreamingProvider[];
    rent: StreamingProvider[];
    stream: StreamingProvider[];
  };
  link: string | null;
};

export type StreamingAvailabilityResponse = {
  availability: StreamingAvailability;
  provider: 'tmdb';
};

export function searchCatalogue(query: string, type: CatalogueSearchType) {
  const params = new URLSearchParams({ query, type });

  return apiGet<CatalogueSearchResponse>(`/catalog/search?${params.toString()}`);
}

export function getTrendingCatalogue() {
  return apiGet<CatalogueSearchResponse>('/catalog/trending');
}

export function getCatalogueMovieSections() {
  return apiGet<CatalogueMovieSectionsResponse>('/catalog/movie-sections');
}

export function getMovieDetails(tmdbId: number) {
  return apiGet<MovieDetailsResponse>(`/catalog/movies/${tmdbId}`);
}

export function getSeriesDetails(tmdbId: number) {
  return apiGet<SeriesDetailsResponse>(`/catalog/series/${tmdbId}`);
}

export function getSeasonDetails(tmdbId: number, seasonNumber: number) {
  return apiGet<SeasonDetailsResponse>(`/catalog/series/${tmdbId}/seasons/${seasonNumber}`);
}

export function getEpisodeDetails(tmdbId: number, seasonNumber: number, episodeNumber: number) {
  return apiGet<EpisodeDetailsResponse>(
    `/catalog/series/${tmdbId}/seasons/${seasonNumber}/episodes/${episodeNumber}`,
  );
}

export function getMovieStreamingAvailability(tmdbId: number, country = 'US') {
  const params = new URLSearchParams({ country });

  return apiGet<StreamingAvailabilityResponse>(
    `/catalog/movies/${tmdbId}/watch-providers?${params.toString()}`,
  );
}

export function getSeriesStreamingAvailability(tmdbId: number, country = 'US') {
  const params = new URLSearchParams({ country });

  return apiGet<StreamingAvailabilityResponse>(
    `/catalog/series/${tmdbId}/watch-providers?${params.toString()}`,
  );
}
