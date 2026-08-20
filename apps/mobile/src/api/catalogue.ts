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

export type CatalogueSpotlightItem = CatalogueSearchItem & {
  backdropUrl: string;
};

export type CatalogueMovieSectionsResponse = {
  announced: CatalogueSearchItem[];
  announcedSeries: CatalogueSearchItem[];
  provider: 'tmdb';
  spotlight: CatalogueSpotlightItem | null;
  trending: CatalogueSearchItem[];
  trendingSeries: CatalogueSearchItem[];
};

export type OnboardingTasteOptionsResponse = {
  movieGenres: { id: number; name: string }[];
  movies: CatalogueSearchItem[];
  provider: 'tmdb';
  series: CatalogueSearchItem[];
};

export type CatalogueDiscoveryItem = CatalogueSearchItem & {
  genres: string[];
};

export type CatalogueDiscoveryResponse = {
  items: CatalogueDiscoveryItem[];
  provider: 'tmdb';
};

export type DisplayRating = {
  average: number;
  count: number | null;
  scale: 5 | 10;
  source: 'watchly' | 'tmdb';
};

export type CatalogueCastMember = {
  character: string | null;
  id: number;
  name: string;
  profileUrl: string | null;
};

export type CatalogueCompany = {
  id: number;
  logoUrl: string | null;
  name: string;
};

export type CatalogueRelatedItem = {
  mediaType: 'movie' | 'series';
  posterUrl: string | null;
  releaseDate: string | null;
  title: string;
  tmdbId: number;
};

export type CatalogueVideo = {
  id: string;
  key: string;
  name: string;
  publishedAt: string | null;
  type: string;
};

export type MovieDetails = {
  backdropUrl: string | null;
  budget: number | null;
  cast: CatalogueCastMember[];
  directors: string[];
  displayRating: DisplayRating | null;
  genres: string[];
  id: string;
  logoAspectRatio: number | null;
  logoUrl: string | null;
  mediaType: 'movie';
  keywords: string[];
  originalTitle: string | null;
  overview: string;
  posterUrl: string | null;
  productionCompanies: CatalogueCompany[];
  recommendations: CatalogueRelatedItem[];
  releaseDate: string | null;
  revenue: number | null;
  runtimeMinutes: number | null;
  status: string | null;
  tagline: string | null;
  title: string;
  tmdbId: number;
  videos: CatalogueVideo[];
  voteAverage: number | null;
  writers: string[];
};

export type MovieDetailsResponse = {
  item: MovieDetails;
  provider: 'tmdb';
};

export type SeriesDetails = {
  backdropUrl: string | null;
  cast: CatalogueCastMember[];
  createdBy: string[];
  firstAirDate: string | null;
  genres: string[];
  id: string;
  inProduction: boolean;
  logoAspectRatio: number | null;
  logoUrl: string | null;
  mediaType: 'series';
  keywords: string[];
  lastAirDate: string | null;
  networks: CatalogueCompany[];
  numberOfEpisodes: number | null;
  numberOfSeasons: number | null;
  originalTitle: string | null;
  overview: string;
  posterUrl: string | null;
  productionCompanies: CatalogueCompany[];
  recommendations: CatalogueRelatedItem[];
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
  videos: CatalogueVideo[];
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
  cast: {
    character: string | null;
    id: number;
    name: string;
    profileUrl: string | null;
  }[];
  crew: {
    id: number;
    jobs: string[];
    name: string;
    profileUrl: string | null;
  }[];
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

export function getCatalogueMovieSections() {
  return apiGet<CatalogueMovieSectionsResponse>('/catalog/movie-sections');
}

export function getOnboardingTasteOptions(movieGenreId?: number) {
  const params = movieGenreId === undefined
    ? ''
    : `?${new URLSearchParams({ movieGenreId: String(movieGenreId) }).toString()}`;

  return apiGet<OnboardingTasteOptionsResponse>(`/catalog/onboarding-taste-options${params}`);
}

export function getCatalogueDiscovery(
  section: 'announced' | 'trending',
  mediaType: 'movie' | 'series',
) {
  const params = new URLSearchParams({ section, type: mediaType });

  return apiGet<CatalogueDiscoveryResponse>(`/catalog/discovery?${params.toString()}`);
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
