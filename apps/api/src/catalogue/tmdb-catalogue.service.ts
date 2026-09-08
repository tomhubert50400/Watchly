import { browseGenreIds, moodGenreIds, type BrowseFilters } from './discover-model';
import {
  BadGatewayException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../database/prisma.service';
import { isPrismaConnectionError } from '../database/prisma-retry';
import type { DiscoverCollectionId, DiscoverMediaType, DiscoverTitle } from './discover-model';
import {
  chooseWeeklySpotlight,
  getSpotlightExpiry,
  isSpotlightActive,
} from './catalogue-spotlight';

const TMDB_LANGUAGE = 'en-US';
const TMDB_IMAGE_LANGUAGES = 'en,null';
const CATALOGUE_SPOTLIGHT_ID = 'home-en-v1';

export type CatalogueSearchType = 'all' | 'movie' | 'series';

type TmdbSearchResult = {
  backdrop_path?: string | null;
  first_air_date?: string;
  genre_ids?: number[];
  id: number;
  media_type?: string;
  name?: string;
  overview?: string;
  popularity?: number;
  poster_path?: string | null;
  release_date?: string;
  title?: string;
  vote_average?: number;
};

type TmdbSearchResponse = {
  results?: TmdbSearchResult[];
};

type TmdbGenreResponse = {
  genres?: { id: number; name: string }[];
};

type TmdbFindResponse = {
  movie_results?: TmdbSearchResult[];
  tv_results?: TmdbSearchResult[];
};

type TmdbLogoImage = {
  file_path?: string | null;
  height?: number;
  iso_639_1?: string | null;
  vote_average?: number;
  vote_count?: number;
  width?: number;
};

type TmdbPosterImage = TmdbLogoImage;

type TmdbMovieDetailsResponse = {
  belongs_to_collection?: { id: number; name: string } | null;
  backdrop_path?: string | null;
  budget?: number;
  credits?: {
    cast?: TmdbCredit[];
    crew?: TmdbCredit[];
  };
  genres?: { id: number; name: string }[];
  id: number;
  images?: {
    logos?: TmdbLogoImage[];
    posters?: TmdbPosterImage[];
  };
  keywords?: { keywords?: TmdbKeyword[] };
  original_title?: string;
  overview?: string;
  poster_path?: string | null;
  production_companies?: TmdbProductionCompany[];
  recommendations?: { results?: TmdbSearchResult[] };
  release_date?: string;
  revenue?: number;
  runtime?: number | null;
  status?: string;
  tagline?: string;
  title?: string;
  videos?: { results?: TmdbVideo[] };
  vote_average?: number;
};

type TmdbSeriesDetailsResponse = {
  backdrop_path?: string | null;
  created_by?: {
    id: number;
    name?: string;
    profile_path?: string | null;
  }[];
  credits?: {
    cast?: TmdbCredit[];
    crew?: TmdbCredit[];
  };
  first_air_date?: string;
  genres?: { id: number; name: string }[];
  id: number;
  images?: {
    logos?: TmdbLogoImage[];
    posters?: TmdbPosterImage[];
  };
  in_production?: boolean;
  keywords?: { results?: TmdbKeyword[] };
  last_air_date?: string;
  name?: string;
  networks?: TmdbProductionCompany[];
  number_of_episodes?: number;
  number_of_seasons?: number;
  original_name?: string;
  overview?: string;
  poster_path?: string | null;
  production_companies?: TmdbProductionCompany[];
  recommendations?: { results?: TmdbSearchResult[] };
  seasons?: {
    air_date?: string | null;
    episode_count?: number;
    id: number;
    name?: string;
    poster_path?: string | null;
    season_number: number;
  }[];
  status?: string;
  tagline?: string;
  videos?: { results?: TmdbVideo[] };
  vote_average?: number;
};

type TmdbSeasonDetailsResponse = {
  air_date?: string | null;
  episodes?: {
    air_date?: string | null;
    episode_number: number;
    id: number;
    name?: string;
    overview?: string;
    runtime?: number | null;
    season_number: number;
    still_path?: string | null;
    vote_average?: number;
  }[];
  id: number;
  name?: string;
  overview?: string;
  poster_path?: string | null;
  season_number: number;
};

type TmdbEpisodeDetailsResponse = {
  air_date?: string | null;
  credits?: {
    cast?: TmdbEpisodeCredit[];
    crew?: TmdbEpisodeCrewCredit[];
    guest_stars?: TmdbEpisodeCredit[];
  };
  episode_number: number;
  id: number;
  name?: string;
  overview?: string;
  runtime?: number | null;
  season_number: number;
  still_path?: string | null;
  vote_average?: number;
};

type TmdbCredit = {
  character?: string;
  department?: string;
  id: number;
  job?: string;
  name?: string;
  order?: number;
  profile_path?: string | null;
};

type TmdbKeyword = {
  id: number;
  name?: string;
};

type TmdbProductionCompany = {
  id: number;
  logo_path?: string | null;
  name?: string;
};

type TmdbVideo = {
  id: string;
  key?: string;
  name?: string;
  official?: boolean;
  published_at?: string;
  site?: string;
  type?: string;
};

type TmdbEpisodeCredit = {
  character?: string;
  id: number;
  name?: string;
  order?: number;
  original_name?: string;
  profile_path?: string | null;
};

type TmdbEpisodeCrewCredit = {
  department?: string;
  id: number;
  job?: string;
  name?: string;
  original_name?: string;
  profile_path?: string | null;
};

type TmdbWatchProvider = {
  display_priority?: number;
  logo_path?: string | null;
  provider_id: number;
  provider_name?: string;
};

type TmdbWatchProviderCountry = {
  buy?: TmdbWatchProvider[];
  flatrate?: TmdbWatchProvider[];
  free?: TmdbWatchProvider[];
  link?: string;
  rent?: TmdbWatchProvider[];
};

type TmdbWatchProvidersResponse = {
  id: number;
  results?: Record<string, TmdbWatchProviderCountry>;
};

type DisplayRating = {
  average: number;
  count: number | null;
  scale: 5 | 10;
  source: 'watchly' | 'tmdb';
};

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

export type CatalogueSpotlightItem = CatalogueSearchItem & {
  backdropUrl: string;
};

export type CatalogueDiscoveryItem = CatalogueSearchItem & {
  genres: string[];
};

export type CatalogueDiscoveryMediaType = 'movie' | 'series';
export type CatalogueDiscoverySection = 'announced' | 'trending';

type StoredCatalogueSpotlight = {
  backdropUrl: string;
  expiresAt: Date;
  id: string;
  overview: string;
  posterUrl: string | null;
  releaseDate: string | null;
  selectedAt: Date;
  title: string;
  tmdbId: number;
  updatedAt: Date;
  voteAverage: number | null;
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
  collection?: { id: number; name: string } | null;
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

export type EpisodeDetails = {
  airDate: string | null;
  cast: EpisodeCastMember[];
  crew: EpisodeCrewMember[];
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

export type EpisodeCastMember = {
  character: string | null;
  id: number;
  name: string;
  profileUrl: string | null;
};

export type EpisodeCrewMember = {
  id: number;
  jobs: string[];
  name: string;
  profileUrl: string | null;
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

export type StreamingProvider = {
  id: number;
  logoUrl: string | null;
  name: string;
};

@Injectable()
export class TmdbCatalogueService {
  private readonly discoverCache = new Map<string, { expires: number; value: unknown }>();
  private readonly discoverRequests = new Map<string, Promise<unknown>>();
  private readonly watchlyRatingThreshold = 100;
  private readonly imageBaseUrl = 'https://image.tmdb.org/t/p/w342';
  private readonly backdropBaseUrl = 'https://image.tmdb.org/t/p/w780';
  private readonly logoBaseUrl = 'https://image.tmdb.org/t/p/w500';
  private readonly tmdbBaseUrl = 'https://api.themoviedb.org/3';

  constructor(
    @Inject(ConfigService) private readonly config: ConfigService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  async findByImdbId(imdbId: string) {
    return this.findByExternalId(imdbId, 'imdb_id');
  }

  async discoverTitle(mediaType: DiscoverMediaType, tmdbId: number) {
    const type = mediaType === 'movie' ? 'movie' : 'tv';
    const payload = await this.fetchDiscover<TmdbSearchResult & { genres?: { id: number }[]; recommendations?: TmdbSearchResponse }>(
      `${type}/${tmdbId}`, { append_to_response: 'recommendations' },
    );
    return {
      item: this.toDiscoverTitle({ ...payload, genre_ids: payload.genres?.map(genre => genre.id) }, mediaType),
      recommendations: (payload.recommendations?.results ?? []).map(item => this.toDiscoverTitle(item, mediaType)),
    };
  }

  async discoverCandidates(mediaType: DiscoverMediaType, collection?: DiscoverCollectionId, page = 1, filters: BrowseFilters = {}) {
    const type = mediaType === 'movie' ? 'movie' : 'tv';
    const dates = filters.decade ? [`${filters.decade}-01-01`, `${filters.decade + 9}-12-31`] : collection === '2000s' ? ['2000-01-01', '2009-12-31'] : collection === '1990s' ? ['1990-01-01', '1999-12-31'] : null;
    const dateField = mediaType === 'movie' ? 'primary_release_date' : 'first_air_date';
    const payload = await this.fetchDiscover<TmdbSearchResponse>(`discover/${type}`, {
      include_adult: 'false', sort_by: 'popularity.desc', 'vote_count.gte': '100', page: String(page),
      [`${dateField}.lte`]: new Date().toISOString().slice(0, 10),
      ...(dates ? { [`${dateField}.gte`]: dates[0], [`${dateField}.lte`]: dates[1] } : {}),
      ...(collection === 'animation' ? { with_genres: '16' } : {}),
      ...(filters.genre ? { with_genres: browseGenreIds(filters.genre, mediaType).join('|') } : filters.mood ? { with_genres: moodGenreIds[filters.mood][mediaType].join('|') } : {}),
    });
    return (payload.results ?? []).map(item => this.toDiscoverTitle(item, mediaType));
  }

  private toDiscoverTitle(item: TmdbSearchResult, mediaType: DiscoverMediaType): DiscoverTitle {
    return {
      id: `${mediaType}:${item.id}`, tmdbId: item.id, mediaType,
      title: item.title || item.name || 'Untitled', overview: item.overview ?? '',
      posterUrl: item.poster_path ? `${this.imageBaseUrl}${item.poster_path}` : null,
      backdropUrl: item.backdrop_path ? `${this.backdropBaseUrl}${item.backdrop_path}` : null,
      releaseDate: item.release_date || item.first_air_date || null,
      voteAverage: item.vote_average ?? null, genreIds: item.genre_ids ?? [],
    };
  }

  private async fetchDiscover<T>(path: string, params: Record<string, string>): Promise<T> {
    const endpoint = `${this.tmdbBaseUrl}/${path}?${new URLSearchParams({ language: TMDB_LANGUAGE, ...params })}`;
    const cached = this.discoverCache.get(endpoint);
    if (cached && cached.expires > Date.now()) return cached.value as T;
    const pending = this.discoverRequests.get(endpoint);
    if (pending) return pending as Promise<T>;
    const request = this.fetchTmdb<T>(endpoint, this.getAccessToken(), 'discovery').then(value => {
      if (this.discoverCache.size >= 500) this.discoverCache.delete(this.discoverCache.keys().next().value!);
      this.discoverCache.set(endpoint, { expires: Date.now() + 60 * 60 * 1000, value });
      return value;
    }).finally(() => this.discoverRequests.delete(endpoint));
    this.discoverRequests.set(endpoint, request);
    return request;
  }

  async findByTvdbId(tvdbId: number) {
    return this.findByExternalId(String(tvdbId), 'tvdb_id');
  }

  async findEpisodeByTvdbId(tvdbId: number) {
    const endpoint = `${this.tmdbBaseUrl}/find/${tvdbId}?external_source=tvdb_id`;
    const result = await this.fetchTmdb<{
      tv_episode_results?: { show_id: number; season_number: number; episode_number: number }[];
    }>(endpoint, this.getAccessToken(), 'episode external ID');
    return result.tv_episode_results ?? [];
  }

  private async findByExternalId(
    externalId: string,
    source: 'imdb_id' | 'tvdb_id',
  ) {
    const accessToken = this.config.get<string>('TMDB_ACCESS_TOKEN');

    if (!accessToken) {
      throw new ServiceUnavailableException('TMDB_ACCESS_TOKEN is not configured.');
    }

    const endpoint = new URL(`${this.tmdbBaseUrl}/find/${encodeURIComponent(externalId)}`);
    endpoint.searchParams.set('external_source', source);
    endpoint.searchParams.set('language', TMDB_LANGUAGE);

    try {
      const payload = await fetchWithTimeout(
        endpoint,
        {
          headers: {
            accept: 'application/json',
            authorization: ['Bearer', accessToken].join(' '),
          },
        },
        async (response) => {
          if (!response.ok) {
            throw new BadGatewayException('TMDB external ID request failed.');
          }

          return response.json() as Promise<TmdbFindResponse>;
        },
      );

      return {
        items: [
          ...(payload.movie_results ?? []).map((item) => this.toCatalogueItem(item, 'movie')),
          ...(payload.tv_results ?? []).map((item) => this.toCatalogueItem(item, 'series')),
        ].filter((item): item is CatalogueSearchItem => Boolean(item)),
        provider: 'tmdb' as const,
      };
    } catch (error) {
      if (error instanceof BadGatewayException) {
        throw error;
      }

      throw new BadGatewayException('Could not reach TMDB.');
    }
  }

  async search(query: string, type: CatalogueSearchType) {
    const accessToken = this.config.get<string>('TMDB_ACCESS_TOKEN');

    if (!accessToken) {
      throw new ServiceUnavailableException('TMDB_ACCESS_TOKEN is not configured.');
    }

    const mediaTypes: ('movie' | 'series')[] =
      type === 'all' ? ['movie', 'series'] : [type];
    let payloads: { mediaType: 'movie' | 'series'; payload: TmdbSearchResponse }[];

    try {
      payloads = await Promise.all(
        mediaTypes.map(async (mediaType) => ({
          mediaType,
          payload: await fetchWithTimeout(
            this.buildSearchEndpoint(query, mediaType),
            {
              headers: {
                accept: 'application/json',
                authorization: ['Bearer', accessToken].join(' '),
              },
            },
            async (response) => {
              if (!response.ok) {
                throw new BadGatewayException('TMDB search request failed.');
              }

              return response.json() as Promise<TmdbSearchResponse>;
            },
          ),
        })),
      );
    } catch (error) {
      if (error instanceof BadGatewayException) {
        throw error;
      }

      throw new BadGatewayException('Could not reach TMDB.');
    }
    const results = payloads
      .flatMap(({ mediaType, payload }, sourceIndex) =>
        (payload.results ?? []).map((item, rank) => ({ item, mediaType, rank, sourceIndex })),
      )
      .sort((left, right) => left.rank - right.rank || left.sourceIndex - right.sourceIndex);

    return {
      items: results
        .map(({ item, mediaType }) => this.toCatalogueItem(item, mediaType))
        .filter((item): item is CatalogueSearchItem => Boolean(item))
        .slice(0, 20),
      provider: 'tmdb',
    };
  }

  async onboardingTasteOptions(movieGenreId?: number) {
    const accessToken = this.getAccessToken();
    const movieEndpoint = (page: number) => movieGenreId
      ? buildGenreMovieEndpoint(this.tmdbBaseUrl, movieGenreId, page)
      : buildPopularEndpoint(this.tmdbBaseUrl, 'movie', page);
    const movieLabel = movieGenreId ? `genre ${movieGenreId} movies` : 'popular movies';
    const [movieGenres, moviePageOne, moviePageTwo, seriesPageOne, seriesPageTwo] = await Promise.all([
      this.fetchTmdb<TmdbGenreResponse>(
        `${this.tmdbBaseUrl}/genre/movie/list?${new URLSearchParams({ language: TMDB_LANGUAGE }).toString()}`,
        accessToken,
        'movie genres',
      ),
      this.fetchTmdb<TmdbSearchResponse>(
        movieEndpoint(1),
        accessToken,
        `${movieLabel} page 1`,
      ),
      this.fetchTmdb<TmdbSearchResponse>(
        movieEndpoint(2),
        accessToken,
        `${movieLabel} page 2`,
      ),
      this.fetchTmdb<TmdbSearchResponse>(
        buildPopularEndpoint(this.tmdbBaseUrl, 'series', 1),
        accessToken,
        'popular series page 1',
      ),
      this.fetchTmdb<TmdbSearchResponse>(
        buildPopularEndpoint(this.tmdbBaseUrl, 'series', 2),
        accessToken,
        'popular series page 2',
      ),
    ]);
    const toOptions = (
      payloads: readonly TmdbSearchResponse[],
      mediaType: 'movie' | 'series',
    ) => deduplicateTmdbResults(payloads.flatMap((payload) => payload.results ?? []))
      .map((item) => this.toCatalogueItem(item, mediaType))
      .filter((item): item is CatalogueSearchItem => Boolean(item))
      .filter((item) => isReleasedDate(item.releaseDate))
      .slice(0, 21);

    return {
      movieGenres: [...(movieGenres.genres ?? [])]
        .filter((genre) => Number.isInteger(genre.id) && genre.id > 0 && Boolean(genre.name.trim()))
        .sort((left, right) => left.name.localeCompare(right.name)),
      movies: toOptions([moviePageOne, moviePageTwo], 'movie'),
      provider: 'tmdb' as const,
      series: toOptions([seriesPageOne, seriesPageTwo], 'series'),
    };
  }

  async trending() {
    const accessToken = this.getAccessToken();
    const params = new URLSearchParams({ language: TMDB_LANGUAGE });
    const endpoint = `${this.tmdbBaseUrl}/trending/movie/day?${params.toString()}`;
    const payload = await this.fetchTmdb<TmdbSearchResponse>(endpoint, accessToken, 'trending');

    return {
      items: (payload.results ?? [])
        .map((item) => this.toCatalogueItem(item, 'movie'))
        .filter((item): item is CatalogueSearchItem => Boolean(item))
        .filter((item) => isReleasedDate(item.releaseDate))
        .sort((left, right) => getDateSortValue(right.releaseDate) - getDateSortValue(left.releaseDate))
        .slice(0, 10),
      provider: 'tmdb',
    };
  }

  async movieSections() {
    const accessToken = this.getAccessToken();
    const trendingParams = new URLSearchParams({ language: TMDB_LANGUAGE, page: '1' });
    const weeklyTrendingParams = new URLSearchParams({ language: TMDB_LANGUAGE, page: '1' });
    const seriesTrendingParams = new URLSearchParams({ language: TMDB_LANGUAGE, page: '1' });
    const announcedSeriesParams = buildAnnouncedSeriesParams(1);
    const upcomingPages = [1, 2, 3, 4, 5];
    const [
      trendingPayload,
      weeklyTrendingPayload,
      seriesTrendingPayload,
      announcedSeriesPayload,
      ...upcomingPayloads
    ] = await Promise.all([
      this.fetchTmdb<TmdbSearchResponse>(
        `${this.tmdbBaseUrl}/trending/movie/day?${trendingParams.toString()}`,
        accessToken,
        'trending movies',
      ),
      this.fetchTmdb<TmdbSearchResponse>(
        `${this.tmdbBaseUrl}/trending/movie/week?${weeklyTrendingParams.toString()}`,
        accessToken,
        'weekly trending movies',
      ),
      this.fetchTmdb<TmdbSearchResponse>(
        `${this.tmdbBaseUrl}/trending/tv/day?${seriesTrendingParams.toString()}`,
        accessToken,
        'trending series',
      ),
      this.fetchTmdb<TmdbSearchResponse>(
        `${this.tmdbBaseUrl}/discover/tv?${announcedSeriesParams.toString()}`,
        accessToken,
        'announced series',
      ),
      ...upcomingPages.map((page) =>
        this.fetchTmdb<TmdbSearchResponse>(
          `${this.tmdbBaseUrl}/movie/upcoming?${new URLSearchParams({
            language: TMDB_LANGUAGE,
            page: String(page),
          }).toString()}`,
          accessToken,
          'announced movies',
        ),
      ),
    ]);
    const spotlight = await this.resolveWeeklySpotlight(weeklyTrendingPayload.results ?? []);

    return {
      announced: upcomingPayloads
        .flatMap((payload) => payload.results ?? [])
        .filter((item) => isAnnouncedReleaseDate(item.release_date))
        .sort(compareAnnouncedCandidates)
        .map((item) => this.toCatalogueItem(item, 'movie'))
        .filter((item): item is CatalogueSearchItem => Boolean(item))
        .slice(0, 10),
      announcedSeries: (announcedSeriesPayload.results ?? [])
        .filter((item) => isAnnouncedReleaseDate(item.first_air_date))
        .sort(compareAnnouncedCandidates)
        .map((item) => this.toCatalogueItem(item, 'series'))
        .filter((item): item is CatalogueSearchItem => Boolean(item))
        .slice(0, 10),
      provider: 'tmdb',
      spotlight,
      trending: (trendingPayload.results ?? [])
        .map((item) => this.toCatalogueItem(item, 'movie'))
        .filter((item): item is CatalogueSearchItem => Boolean(item))
        .filter((item) => isReleasedDate(item.releaseDate))
        .filter((item) => item.tmdbId !== spotlight?.tmdbId)
        .slice(0, 10),
      trendingSeries: (seriesTrendingPayload.results ?? [])
        .map((item) => this.toCatalogueItem(item, 'series'))
        .filter((item): item is CatalogueSearchItem => Boolean(item))
        .slice(0, 10),
    };
  }

  async discovery(section: CatalogueDiscoverySection, mediaType: CatalogueDiscoveryMediaType) {
    const accessToken = this.getAccessToken();
    const tmdbMediaType = mediaType === 'series' ? 'tv' : 'movie';
    const pages = [1, 2, 3];
    const [genrePayload, ...pagePayloads] = await Promise.all([
      this.fetchTmdb<TmdbGenreResponse>(
        `${this.tmdbBaseUrl}/genre/${tmdbMediaType}/list?${new URLSearchParams({
          language: TMDB_LANGUAGE,
        }).toString()}`,
        accessToken,
        `${mediaType} genres`,
      ),
      ...pages.map((page) => this.fetchTmdb<TmdbSearchResponse>(
        buildDiscoveryEndpoint(this.tmdbBaseUrl, section, mediaType, page),
        accessToken,
        `${section} ${mediaType}`,
      )),
    ]);
    const genreNames = new Map((genrePayload.genres ?? []).map((genre) => [genre.id, genre.name]));
    const candidates = deduplicateTmdbResults(pagePayloads.flatMap((payload) => payload.results ?? []));
    const selectedCandidates = section === 'announced'
      ? candidates
          .filter((item) => isAnnouncedReleaseDate(item.release_date ?? item.first_air_date))
          .sort(compareAnnouncedCandidates)
      : candidates;

    return {
      items: selectedCandidates
        .map((item) => this.toDiscoveryItem(item, mediaType, genreNames))
        .filter((item): item is CatalogueDiscoveryItem => Boolean(item)),
      provider: 'tmdb' as const,
    };
  }

  async getMovie(tmdbId: number) {
    const accessToken = this.getAccessToken();
    const params = new URLSearchParams({
      append_to_response: 'images,credits,videos,keywords,recommendations',
      include_image_language: TMDB_IMAGE_LANGUAGES,
      language: TMDB_LANGUAGE,
    });
    const endpoint = `${this.tmdbBaseUrl}/movie/${tmdbId}?${params.toString()}`;
    const payload = await this.fetchTmdb<TmdbMovieDetailsResponse>(endpoint, accessToken, 'movie details');

    if (!payload.title) {
      throw new NotFoundException('Movie details were not found.');
    }

    return {
      item: this.toMovieDetails(payload, await this.getMovieDisplayRating(tmdbId, payload.vote_average)),
      provider: 'tmdb',
    };
  }

  async getSeries(tmdbId: number) {
    const accessToken = this.getAccessToken();
    const params = new URLSearchParams({
      append_to_response: 'images,credits,videos,keywords,recommendations',
      include_image_language: TMDB_IMAGE_LANGUAGES,
      language: TMDB_LANGUAGE,
    });
    const endpoint = `${this.tmdbBaseUrl}/tv/${tmdbId}?${params.toString()}`;
    const payload = await this.fetchTmdb<TmdbSeriesDetailsResponse>(endpoint, accessToken, 'series details');

    if (!payload.name) {
      throw new NotFoundException('Series details were not found.');
    }

    return {
      item: this.toSeriesDetails(payload),
      provider: 'tmdb',
    };
  }

  async getSeason(tmdbId: number, seasonNumber: number) {
    const accessToken = this.getAccessToken();
    const params = new URLSearchParams({ language: TMDB_LANGUAGE });
    const endpoint = `${this.tmdbBaseUrl}/tv/${tmdbId}/season/${seasonNumber}?${params.toString()}`;
    const payload = await this.fetchTmdb<TmdbSeasonDetailsResponse>(endpoint, accessToken, 'season details');

    if (!payload.name) {
      throw new NotFoundException('Season details were not found.');
    }

    return {
      item: this.toSeasonDetails(tmdbId, payload),
      provider: 'tmdb',
    };
  }

  async getEpisode(tmdbId: number, seasonNumber: number, episodeNumber: number) {
    const accessToken = this.getAccessToken();
    const params = new URLSearchParams({
      append_to_response: 'credits',
      language: TMDB_LANGUAGE,
    });
    const endpoint = `${this.tmdbBaseUrl}/tv/${tmdbId}/season/${seasonNumber}/episode/${episodeNumber}?${params.toString()}`;
    const payload = await this.fetchTmdb<TmdbEpisodeDetailsResponse>(endpoint, accessToken, 'episode details');

    if (!payload.name) {
      throw new NotFoundException('Episode details were not found.');
    }

    return {
      item: this.toEpisodeDetails(tmdbId, payload),
      provider: 'tmdb',
    };
  }

  async getMovieWatchProviders(tmdbId: number, country: string) {
    const accessToken = this.getAccessToken();
    const endpoint = `${this.tmdbBaseUrl}/movie/${tmdbId}/watch/providers`;
    const payload = await this.fetchTmdb<TmdbWatchProvidersResponse>(
      endpoint,
      accessToken,
      'movie watch providers',
    );

    return {
      availability: this.toStreamingAvailability(payload, country),
      provider: 'tmdb',
    };
  }

  async getSeriesWatchProviders(tmdbId: number, country: string) {
    const accessToken = this.getAccessToken();
    const endpoint = `${this.tmdbBaseUrl}/tv/${tmdbId}/watch/providers`;
    const payload = await this.fetchTmdb<TmdbWatchProvidersResponse>(
      endpoint,
      accessToken,
      'series watch providers',
    );

    return {
      availability: this.toStreamingAvailability(payload, country),
      provider: 'tmdb',
    };
  }

  private buildSearchEndpoint(query: string, mediaType: 'movie' | 'series') {
    const params = new URLSearchParams({
      include_adult: 'false',
      language: TMDB_LANGUAGE,
      page: '1',
      query,
    });

    const endpointType = mediaType === 'series' ? 'tv' : 'movie';

    return `${this.tmdbBaseUrl}/search/${endpointType}?${params.toString()}`;
  }

  async getCollection(collectionId: number) {
    const params = new URLSearchParams({ language: TMDB_LANGUAGE });
    const payload = await this.fetchTmdb<{ name: string; parts?: TmdbSearchResult[] }>(
      `${this.tmdbBaseUrl}/collection/${collectionId}?${params.toString()}`,
      this.getAccessToken(),
      'movie collection',
    );
    return {
      items: (payload.parts ?? []).filter((item) => item.title).map((item): CatalogueRelatedItem => ({
        mediaType: 'movie',
        posterUrl: item.poster_path ? `${this.imageBaseUrl}${item.poster_path}` : null,
        releaseDate: item.release_date || null,
        title: item.title!,
        tmdbId: item.id,
      })),
      name: payload.name,
      provider: 'tmdb' as const,
    };
  }

  private async fetchTmdb<T>(endpoint: string, accessToken: string, label: string): Promise<T> {
    try {
      return await fetchWithTimeout(
        endpoint,
        {
          headers: {
            accept: 'application/json',
            authorization: ['Bearer', accessToken].join(' '),
          },
        },
        async (response) => {
          if (response.status === 404) {
            throw new NotFoundException('TMDB item was not found.');
          }

          if (!response.ok) {
            throw new BadGatewayException(`TMDB ${label} request failed.`);
          }

          return response.json() as Promise<T>;
        },
      );
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadGatewayException) {
        throw error;
      }

      throw new BadGatewayException('Could not reach TMDB.');
    }
  }

  private getAccessToken() {
    const accessToken = this.config.get<string>('TMDB_ACCESS_TOKEN');

    if (!accessToken) {
      throw new ServiceUnavailableException('TMDB_ACCESS_TOKEN is not configured.');
    }

    return accessToken;
  }

  private async resolveWeeklySpotlight(
    candidates: readonly TmdbSearchResult[],
  ): Promise<CatalogueSpotlightItem | null> {
    const now = new Date();
    const stored = await this.getStoredSpotlight();

    if (stored?.posterUrl && isSpotlightActive(stored.expiresAt, now)) {
      return this.toStoredSpotlightItem(stored);
    }

    const candidate = chooseWeeklySpotlight(candidates, now);
    const spotlight = candidate ? this.toSpotlightItem(candidate) : null;

    if (!spotlight) {
      return stored?.posterUrl ? this.toStoredSpotlightItem(stored) : null;
    }

    await this.storeSpotlight(spotlight, now);
    return spotlight;
  }

  private async getStoredSpotlight(): Promise<StoredCatalogueSpotlight | null> {
    try {
      return await this.prisma.withConnectionRetry(() =>
        this.prisma.catalogueSpotlight.findUnique({
          where: {
            id: CATALOGUE_SPOTLIGHT_ID,
          },
        }),
      );
    } catch (error) {
      if (isPrismaConnectionError(error)) {
        return null;
      }

      throw error;
    }
  }

  private async storeSpotlight(spotlight: CatalogueSpotlightItem, selectedAt: Date) {
    try {
      await this.prisma.withConnectionRetry(() =>
        this.prisma.catalogueSpotlight.upsert({
          create: {
            backdropUrl: spotlight.backdropUrl,
            expiresAt: getSpotlightExpiry(selectedAt),
            id: CATALOGUE_SPOTLIGHT_ID,
            overview: spotlight.overview,
            posterUrl: spotlight.posterUrl,
            releaseDate: spotlight.releaseDate,
            selectedAt,
            title: spotlight.title,
            tmdbId: spotlight.tmdbId,
            voteAverage: spotlight.voteAverage,
          },
          update: {
            backdropUrl: spotlight.backdropUrl,
            expiresAt: getSpotlightExpiry(selectedAt),
            overview: spotlight.overview,
            posterUrl: spotlight.posterUrl,
            releaseDate: spotlight.releaseDate,
            selectedAt,
            title: spotlight.title,
            tmdbId: spotlight.tmdbId,
            voteAverage: spotlight.voteAverage,
          },
          where: {
            id: CATALOGUE_SPOTLIGHT_ID,
          },
        }),
      );
    } catch (error) {
      if (!isPrismaConnectionError(error)) {
        throw error;
      }
    }
  }

  private toSpotlightItem(item: TmdbSearchResult): CatalogueSpotlightItem | null {
    const catalogueItem = this.toCatalogueItem(item, 'movie');

    if (!catalogueItem || !item.backdrop_path) {
      return null;
    }

    return {
      ...catalogueItem,
      backdropUrl: `${this.backdropBaseUrl}${item.backdrop_path}`,
    };
  }

  private toStoredSpotlightItem(item: StoredCatalogueSpotlight): CatalogueSpotlightItem {
    return {
      backdropUrl: item.backdropUrl,
      id: `movie:${item.tmdbId}`,
      mediaType: 'movie',
      overview: item.overview,
      posterUrl: item.posterUrl,
      releaseDate: item.releaseDate,
      title: item.title,
      tmdbId: item.tmdbId,
      voteAverage: item.voteAverage,
    };
  }

  private toCatalogueItem(
    item: TmdbSearchResult,
    fallbackMediaType?: 'movie' | 'series',
  ): CatalogueSearchItem | null {
    const tmdbMediaType = item.media_type ?? (fallbackMediaType === 'series' ? 'tv' : fallbackMediaType);

    if (tmdbMediaType !== 'movie' && tmdbMediaType !== 'tv') {
      return null;
    }

    const mediaType = tmdbMediaType === 'movie' ? 'movie' : 'series';
    const title = mediaType === 'movie' ? item.title : item.name;

    if (!title || !item.poster_path) {
      return null;
    }

    return {
      id: `${mediaType}:${item.id}`,
      mediaType,
      overview: item.overview ?? '',
      posterUrl: `${this.imageBaseUrl}${item.poster_path}`,
      releaseDate: item.release_date ?? item.first_air_date ?? null,
      title,
      tmdbId: item.id,
      voteAverage: typeof item.vote_average === 'number' ? item.vote_average : null,
    };
  }

  private async getMovieDisplayRating(tmdbId: number, tmdbVoteAverage: number | undefined) {
    const ratingSummary = await this.getMovieRatingSummary(tmdbId);
    const watchlyRatingCount = ratingSummary._count._all;
    const watchlyAverageHalfSteps = ratingSummary._avg.scoreHalfSteps;

    if (watchlyRatingCount >= this.watchlyRatingThreshold && watchlyAverageHalfSteps !== null) {
      return {
        average: toRoundedRating(watchlyAverageHalfSteps / 2),
        count: watchlyRatingCount,
        scale: 5,
        source: 'watchly',
      } satisfies DisplayRating;
    }

    if (typeof tmdbVoteAverage === 'number') {
      return {
        average: toRoundedRating(tmdbVoteAverage),
        count: null,
        scale: 10,
        source: 'tmdb',
      } satisfies DisplayRating;
    }

    return null;
  }

  private async getMovieRatingSummary(tmdbId: number) {
    try {
      return await this.prisma.withConnectionRetry(() =>
        this.prisma.userMovieRating.aggregate({
          _avg: {
            scoreHalfSteps: true,
          },
          _count: {
            _all: true,
          },
          where: {
            tmdbId,
          },
        }),
      );
    } catch (error) {
      if (isPrismaConnectionError(error)) {
        return {
          _avg: {
            scoreHalfSteps: null,
          },
          _count: {
            _all: 0,
          },
        };
      }

      throw error;
    }
  }

  private toMovieDetails(item: TmdbMovieDetailsResponse, displayRating: DisplayRating | null): MovieDetails {
    const logo = selectTmdbLogoAsset(item.images?.logos);
    const posterPath = item.poster_path || selectTmdbPosterPath(item.images?.posters);

    return {
      backdropUrl: item.backdrop_path ? `${this.backdropBaseUrl}${item.backdrop_path}` : null,
      budget: toPositiveNumber(item.budget),
      collection: item.belongs_to_collection ?? null,
      cast: buildCatalogueCast(item.credits?.cast, this.imageBaseUrl),
      directors: buildCrewNames(item.credits?.crew, ['Director']),
      displayRating,
      genres: item.genres?.map((genre) => genre.name).filter(Boolean) ?? [],
      id: `movie:${item.id}`,
      logoAspectRatio: logo?.aspectRatio ?? null,
      logoUrl: logo ? `${this.logoBaseUrl}${logo.path}` : null,
      mediaType: 'movie',
      keywords: buildKeywords(item.keywords?.keywords),
      originalTitle: item.original_title || null,
      overview: item.overview ?? '',
      posterUrl: posterPath ? `${this.imageBaseUrl}${posterPath}` : null,
      productionCompanies: buildCompanies(item.production_companies, this.imageBaseUrl),
      recommendations: buildRecommendations(item.recommendations?.results, 'movie', this.imageBaseUrl),
      releaseDate: item.release_date ?? null,
      revenue: toPositiveNumber(item.revenue),
      runtimeMinutes: typeof item.runtime === 'number' ? item.runtime : null,
      status: item.status ?? null,
      tagline: item.tagline || null,
      title: item.title ?? '',
      tmdbId: item.id,
      videos: buildVideos(item.videos?.results),
      voteAverage: typeof item.vote_average === 'number' ? item.vote_average : null,
      writers: buildCrewNames(item.credits?.crew, ['Screenplay', 'Story', 'Writer']),
    };
  }

  private toSeriesDetails(item: TmdbSeriesDetailsResponse): SeriesDetails {
    const logo = selectTmdbLogoAsset(item.images?.logos);
    const posterPath = item.poster_path || selectTmdbPosterPath(item.images?.posters);

    return {
      backdropUrl: item.backdrop_path ? `${this.backdropBaseUrl}${item.backdrop_path}` : null,
      cast: buildCatalogueCast(item.credits?.cast, this.imageBaseUrl),
      createdBy: uniqueNames(item.created_by),
      firstAirDate: item.first_air_date ?? null,
      genres: item.genres?.map((genre) => genre.name).filter(Boolean) ?? [],
      id: `series:${item.id}`,
      inProduction: Boolean(item.in_production),
      logoAspectRatio: logo?.aspectRatio ?? null,
      logoUrl: logo ? `${this.logoBaseUrl}${logo.path}` : null,
      mediaType: 'series',
      keywords: buildKeywords(item.keywords?.results),
      lastAirDate: item.last_air_date ?? null,
      networks: buildCompanies(item.networks, this.imageBaseUrl),
      numberOfEpisodes: typeof item.number_of_episodes === 'number' ? item.number_of_episodes : null,
      numberOfSeasons: typeof item.number_of_seasons === 'number' ? item.number_of_seasons : null,
      originalTitle: item.original_name || null,
      overview: item.overview ?? '',
      posterUrl: posterPath ? `${this.imageBaseUrl}${posterPath}` : null,
      productionCompanies: buildCompanies(item.production_companies, this.imageBaseUrl),
      recommendations: buildRecommendations(item.recommendations?.results, 'series', this.imageBaseUrl),
      seasons:
        item.seasons?.map((season) => ({
          airDate: season.air_date ?? null,
          episodeCount: typeof season.episode_count === 'number' ? season.episode_count : null,
          id: `series:${item.id}:season:${season.season_number}`,
          name: season.name ?? `Season ${season.season_number}`,
          posterUrl: season.poster_path ? `${this.imageBaseUrl}${season.poster_path}` : null,
          seasonNumber: season.season_number,
        })) ?? [],
      status: item.status ?? null,
      tagline: item.tagline || null,
      title: item.name ?? '',
      tmdbId: item.id,
      videos: buildVideos(item.videos?.results),
      voteAverage: typeof item.vote_average === 'number' ? item.vote_average : null,
    };
  }

  private toSeasonDetails(seriesTmdbId: number, item: TmdbSeasonDetailsResponse): SeasonDetails {
    return {
      airDate: item.air_date ?? null,
      episodes:
        item.episodes?.map((episode) => ({
          airDate: episode.air_date ?? null,
          episodeNumber: episode.episode_number,
          id: `series:${seriesTmdbId}:season:${episode.season_number}:episode:${episode.episode_number}`,
          overview: episode.overview ?? '',
          runtimeMinutes: typeof episode.runtime === 'number' ? episode.runtime : null,
          seasonNumber: episode.season_number,
          stillUrl: episode.still_path ? `${this.backdropBaseUrl}${episode.still_path}` : null,
          title: episode.name ?? `Episode ${episode.episode_number}`,
          tmdbId: episode.id,
          voteAverage: typeof episode.vote_average === 'number' ? episode.vote_average : null,
        })) ?? [],
      id: `series:${seriesTmdbId}:season:${item.season_number}`,
      mediaType: 'season',
      overview: item.overview ?? '',
      posterUrl: item.poster_path ? `${this.imageBaseUrl}${item.poster_path}` : null,
      seasonNumber: item.season_number,
      seriesTmdbId,
      title: item.name ?? `Season ${item.season_number}`,
      tmdbId: item.id,
    };
  }

  private toEpisodeDetails(seriesTmdbId: number, item: TmdbEpisodeDetailsResponse): EpisodeDetails {
    return {
      airDate: item.air_date ?? null,
      cast: buildEpisodeCast(item.credits, this.imageBaseUrl),
      crew: buildEpisodeCrew(item.credits, this.imageBaseUrl),
      episodeNumber: item.episode_number,
      id: `series:${seriesTmdbId}:season:${item.season_number}:episode:${item.episode_number}`,
      mediaType: 'episode',
      overview: item.overview ?? '',
      runtimeMinutes: typeof item.runtime === 'number' ? item.runtime : null,
      seasonNumber: item.season_number,
      seriesTmdbId,
      stillUrl: item.still_path ? `${this.backdropBaseUrl}${item.still_path}` : null,
      title: item.name ?? `Episode ${item.episode_number}`,
      tmdbId: item.id,
      voteAverage: typeof item.vote_average === 'number' ? item.vote_average : null,
    };
  }

  private toStreamingAvailability(
    payload: TmdbWatchProvidersResponse,
    country: string,
  ): StreamingAvailability {
    const countryKey = country.toUpperCase();
    const countryProviders = payload.results?.[countryKey];

    return {
      country: countryKey,
      groups: {
        buy: this.toStreamingProviders(countryProviders?.buy),
        free: this.toStreamingProviders(countryProviders?.free),
        rent: this.toStreamingProviders(countryProviders?.rent),
        stream: this.toStreamingProviders(countryProviders?.flatrate),
      },
      link: countryProviders?.link ?? null,
    };
  }

  private toStreamingProviders(providers: TmdbWatchProvider[] | undefined): StreamingProvider[] {
    return (providers ?? [])
      .filter((provider) => provider.provider_name)
      .sort((left, right) => (left.display_priority ?? 0) - (right.display_priority ?? 0))
      .map((provider) => ({
        id: provider.provider_id,
        logoUrl: provider.logo_path ? `${this.imageBaseUrl}${provider.logo_path}` : null,
        name: provider.provider_name ?? `Provider ${provider.provider_id}`,
      }));
  }

  private toDiscoveryItem(
    item: TmdbSearchResult,
    mediaType: CatalogueDiscoveryMediaType,
    genreNames: ReadonlyMap<number, string>,
  ): CatalogueDiscoveryItem | null {
    const catalogueItem = this.toCatalogueItem(item, mediaType);

    if (!catalogueItem) {
      return null;
    }

    return {
      ...catalogueItem,
      genres: [...new Set(item.genre_ids ?? [])]
        .map((genreId) => genreNames.get(genreId))
        .filter((genre): genre is string => Boolean(genre)),
    };
  }
}

function buildCatalogueCast(
  credits: TmdbCredit[] | undefined,
  imageBaseUrl: string,
): CatalogueCastMember[] {
  return (credits ?? [])
    .filter((credit) => credit.name)
    .sort((left, right) => (left.order ?? Number.MAX_SAFE_INTEGER) - (right.order ?? Number.MAX_SAFE_INTEGER))
    .slice(0, 12)
    .map((credit) => ({
      character: credit.character || null,
      id: credit.id,
      name: credit.name ?? '',
      profileUrl: credit.profile_path ? `${imageBaseUrl}${credit.profile_path}` : null,
    }));
}

function buildCompanies(
  companies: TmdbProductionCompany[] | undefined,
  imageBaseUrl: string,
): CatalogueCompany[] {
  const seen = new Set<number>();

  return (companies ?? []).flatMap((company) => {
    if (!company.name || seen.has(company.id)) {
      return [];
    }

    seen.add(company.id);
    return [{
      id: company.id,
      logoUrl: company.logo_path ? `${imageBaseUrl}${company.logo_path}` : null,
      name: company.name,
    }];
  }).slice(0, 6);
}

function buildCrewNames(credits: TmdbCredit[] | undefined, jobs: string[]) {
  const acceptedJobs = new Set(jobs);
  const seen = new Set<string>();

  return (credits ?? []).flatMap((credit) => {
    const name = credit.name?.trim();

    if (!name || !credit.job || !acceptedJobs.has(credit.job) || seen.has(name)) {
      return [];
    }

    seen.add(name);
    return [name];
  }).slice(0, 4);
}

function buildKeywords(keywords: TmdbKeyword[] | undefined) {
  const seen = new Set<string>();

  return (keywords ?? []).flatMap((keyword) => {
    const name = keyword.name?.trim();
    const key = name?.toLocaleLowerCase('en-US');

    if (!name || !key || seen.has(key)) {
      return [];
    }

    seen.add(key);
    return [name];
  }).slice(0, 12);
}

function buildRecommendations(
  items: TmdbSearchResult[] | undefined,
  mediaType: 'movie' | 'series',
  imageBaseUrl: string,
): CatalogueRelatedItem[] {
  const seen = new Set<number>();

  return (items ?? []).flatMap((item) => {
    const title = mediaType === 'movie' ? item.title : item.name;

    if (!title || !item.poster_path || seen.has(item.id)) {
      return [];
    }

    seen.add(item.id);
    return [{
      mediaType,
      posterUrl: `${imageBaseUrl}${item.poster_path}`,
      releaseDate: (mediaType === 'movie' ? item.release_date : item.first_air_date) ?? null,
      title,
      tmdbId: item.id,
    }];
  }).slice(0, 12);
}

function buildVideos(videos: TmdbVideo[] | undefined): CatalogueVideo[] {
  const seen = new Set<string>();

  return (videos ?? [])
    .filter((video) => video.site === 'YouTube' && (video.type === 'Trailer' || video.type === 'Teaser'))
    .sort((left, right) => {
      const officialDifference = Number(Boolean(right.official)) - Number(Boolean(left.official));

      if (officialDifference !== 0) {
        return officialDifference;
      }

      return Number(right.type === 'Trailer') - Number(left.type === 'Trailer');
    })
    .flatMap((video) => {
      if (!video.key || !video.name || seen.has(video.key)) {
        return [];
      }

      seen.add(video.key);
      return [{
        id: video.id,
        key: video.key,
        name: video.name,
        publishedAt: video.published_at ?? null,
        type: video.type ?? 'Video',
      }];
    })
    .slice(0, 6);
}

function toPositiveNumber(value: number | undefined) {
  return typeof value === 'number' && value > 0 ? value : null;
}

function uniqueNames(items: { name?: string }[] | undefined) {
  const seen = new Set<string>();

  return (items ?? []).flatMap((item) => {
    const name = item.name?.trim();

    if (!name || seen.has(name)) {
      return [];
    }

    seen.add(name);
    return [name];
  }).slice(0, 4);
}

const DEFAULT_TMDB_TIMEOUT_MS = 10_000;

type FetchImplementation = typeof fetch;

export async function fetchWithTimeout<T>(
  input: RequestInfo | URL,
  init: RequestInit = {},
  consumeResponse: (response: Response) => Promise<T>,
  timeoutMs = DEFAULT_TMDB_TIMEOUT_MS,
  fetchImplementation: FetchImplementation = fetch,
): Promise<T> {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new RangeError('HTTP timeout must be a positive finite number.');
  }

  const controller = new AbortController();
  const externalSignal = init.signal;
  const abortFromExternalSignal = () => controller.abort(externalSignal?.reason);

  if (externalSignal?.aborted) {
    abortFromExternalSignal();
  } else {
    externalSignal?.addEventListener('abort', abortFromExternalSignal, { once: true });
  }

  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImplementation(input, {
      ...init,
      signal: controller.signal,
    });

    return await consumeResponse(response);
  } finally {
    clearTimeout(timeout);
    externalSignal?.removeEventListener('abort', abortFromExternalSignal);
  }
}

function toRoundedRating(value: number) {
  return Math.round(value * 10) / 10;
}

function getDateSortValue(value: string | null) {
  if (!value) {
    return 0;
  }

  const timestamp = Date.parse(value);

  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function isReleasedDate(value: string | null) {
  return typeof value === 'string' && value <= getTodayDateKey();
}

function isFutureDate(value: string | null) {
  return typeof value === 'string' && value > getTodayDateKey();
}

type AnnouncedSortCandidate = {
  first_air_date?: string;
  popularity?: number;
  release_date?: string;
};

const ANNOUNCED_RELEASE_GRACE_MS = 6 * 60 * 60 * 1000;

export function isAnnouncedReleaseDate(
  value: string | null | undefined,
  now = new Date(),
) {
  if (typeof value !== 'string') {
    return false;
  }

  const cutoff = new Date(now.getTime() - ANNOUNCED_RELEASE_GRACE_MS)
    .toISOString()
    .slice(0, 10);

  return value >= cutoff;
}

export function compareAnnouncedCandidates(
  left: AnnouncedSortCandidate,
  right: AnnouncedSortCandidate,
) {
  return getPopularitySortValue(right.popularity) - getPopularitySortValue(left.popularity)
    || getDateSortValue(left.release_date ?? left.first_air_date ?? null)
      - getDateSortValue(right.release_date ?? right.first_air_date ?? null);
}

function getTodayDateKey() {
  return new Date().toISOString().slice(0, 10);
}

function buildAnnouncedSeriesParams(page: number) {
  const latestPremiere = new Date();
  latestPremiere.setUTCFullYear(latestPremiere.getUTCFullYear() + 1);

  return new URLSearchParams({
    'first_air_date.gte': getTodayDateKey(),
    'first_air_date.lte': latestPremiere.toISOString().slice(0, 10),
    include_adult: 'false',
    include_null_first_air_dates: 'false',
    language: TMDB_LANGUAGE,
    page: String(page),
    sort_by: 'first_air_date.asc',
  });
}

function buildAnnouncedMovieParams(page: number) {
  const latestRelease = new Date();
  latestRelease.setUTCFullYear(latestRelease.getUTCFullYear() + 1);

  return new URLSearchParams({
    include_adult: 'false',
    language: TMDB_LANGUAGE,
    page: String(page),
    'primary_release_date.gte': getTodayDateKey(),
    'primary_release_date.lte': latestRelease.toISOString().slice(0, 10),
    sort_by: 'popularity.desc',
  });
}

export function buildDiscoveryEndpoint(
  tmdbBaseUrl: string,
  section: CatalogueDiscoverySection,
  mediaType: CatalogueDiscoveryMediaType,
  page: number,
) {
  if (section === 'trending') {
    const tmdbMediaType = mediaType === 'series' ? 'tv' : 'movie';
    const params = new URLSearchParams({ language: TMDB_LANGUAGE, page: String(page) });

    return `${tmdbBaseUrl}/trending/${tmdbMediaType}/day?${params.toString()}`;
  }

  if (mediaType === 'series') {
    return `${tmdbBaseUrl}/discover/tv?${buildAnnouncedSeriesParams(page).toString()}`;
  }

  return `${tmdbBaseUrl}/discover/movie?${buildAnnouncedMovieParams(page).toString()}`;
}

export function buildPopularEndpoint(
  tmdbBaseUrl: string,
  mediaType: CatalogueDiscoveryMediaType,
  page: number,
) {
  const tmdbMediaType = mediaType === 'series' ? 'tv' : 'movie';
  const params = new URLSearchParams({ language: TMDB_LANGUAGE, page: String(page) });

  return `${tmdbBaseUrl}/${tmdbMediaType}/popular?${params.toString()}`;
}

export function buildGenreMovieEndpoint(tmdbBaseUrl: string, genreId: number, page: number) {
  const params = new URLSearchParams({
    include_adult: 'false',
    include_video: 'false',
    language: TMDB_LANGUAGE,
    page: String(page),
    'primary_release_date.lte': getTodayDateKey(),
    sort_by: 'popularity.desc',
    with_genres: String(genreId),
  });

  return `${tmdbBaseUrl}/discover/movie?${params.toString()}`;
}

function deduplicateTmdbResults(items: readonly TmdbSearchResult[]) {
  const seen = new Set<number>();

  return items.filter((item) => {
    if (seen.has(item.id)) {
      return false;
    }

    seen.add(item.id);
    return true;
  });
}

function getPopularitySortValue(value: number | undefined) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

export function selectTmdbLogoAsset(logos: readonly TmdbLogoImage[] | undefined) {
  const languagePriority = new Map<string | null, number>([
    ['en', 0],
    [null, 1],
  ]);
  const candidates = (logos ?? [])
    .filter((logo): logo is TmdbLogoImage & { file_path: string } =>
      Boolean(logo.file_path) && languagePriority.has(logo.iso_639_1 ?? null))
    .sort((left, right) => {
      const languageDifference =
        languagePriority.get(left.iso_639_1 ?? null)!
        - languagePriority.get(right.iso_639_1 ?? null)!;

      return languageDifference
        || (right.vote_average ?? 0) - (left.vote_average ?? 0)
        || (right.vote_count ?? 0) - (left.vote_count ?? 0);
    });

  const logo = candidates[0];

  if (!logo) {
    return null;
  }

  const height = logo.height;
  const width = logo.width;
  const hasValidDimensions =
    typeof width === 'number'
    && Number.isFinite(width)
    && width > 0
    && typeof height === 'number'
    && Number.isFinite(height)
    && height > 0;

  return {
    aspectRatio: hasValidDimensions ? width / height : null,
    path: logo.file_path,
  };
}

export function selectTmdbPosterPath(posters: readonly TmdbPosterImage[] | undefined) {
  const languagePriority = new Map<string | null, number>([
    ['en', 0],
    [null, 1],
  ]);

  return (posters ?? [])
    .filter((poster): poster is TmdbPosterImage & { file_path: string } =>
      Boolean(poster.file_path) && languagePriority.has(poster.iso_639_1 ?? null))
    .sort((left, right) => {
      const languageDifference =
        languagePriority.get(left.iso_639_1 ?? null)!
        - languagePriority.get(right.iso_639_1 ?? null)!;

      return languageDifference
        || (right.vote_average ?? 0) - (left.vote_average ?? 0)
        || (right.vote_count ?? 0) - (left.vote_count ?? 0);
    })[0]?.file_path ?? null;
}

export function buildEpisodeCast(
  credits: TmdbEpisodeDetailsResponse['credits'],
  imageBaseUrl: string,
): EpisodeCastMember[] {
  const seenIds = new Set<number>();
  const orderedCredits = [
    ...[...(credits?.cast ?? [])].sort(compareEpisodeCredits),
    ...[...(credits?.guest_stars ?? [])].sort(compareEpisodeCredits),
  ];

  return orderedCredits.flatMap((credit) => {
    const name = credit.name?.trim() || credit.original_name?.trim();

    if (!name || seenIds.has(credit.id)) {
      return [];
    }

    seenIds.add(credit.id);

    return [{
      character: credit.character?.trim() || null,
      id: credit.id,
      name,
      profileUrl: credit.profile_path ? `${imageBaseUrl}${credit.profile_path}` : null,
    }];
  });
}

function compareEpisodeCredits(left: TmdbEpisodeCredit, right: TmdbEpisodeCredit) {
  return (left.order ?? Number.MAX_SAFE_INTEGER) - (right.order ?? Number.MAX_SAFE_INTEGER);
}

export function buildEpisodeCrew(
  credits: TmdbEpisodeDetailsResponse['credits'],
  imageBaseUrl: string,
): EpisodeCrewMember[] {
  const members = new Map<number, EpisodeCrewMember>();
  const orderedCredits = [...(credits?.crew ?? [])].sort(compareEpisodeCrewCredits);

  orderedCredits.forEach((credit) => {
    const name = credit.name?.trim() || credit.original_name?.trim();
    const job = credit.job?.trim() || credit.department?.trim();

    if (!name || !job) {
      return;
    }

    const existing = members.get(credit.id);

    if (existing) {
      if (!existing.jobs.includes(job)) {
        existing.jobs.push(job);
      }
      return;
    }

    members.set(credit.id, {
      id: credit.id,
      jobs: [job],
      name,
      profileUrl: credit.profile_path ? `${imageBaseUrl}${credit.profile_path}` : null,
    });
  });

  return [...members.values()];
}

function compareEpisodeCrewCredits(
  left: TmdbEpisodeCrewCredit,
  right: TmdbEpisodeCrewCredit,
) {
  return getCrewDepartmentPriority(left.department) - getCrewDepartmentPriority(right.department)
    || (left.name ?? left.original_name ?? '').localeCompare(
      right.name ?? right.original_name ?? '',
    );
}

function getCrewDepartmentPriority(department: string | undefined) {
  if (department === 'Directing') return 0;
  if (department === 'Writing') return 1;
  if (department === 'Production') return 2;
  if (department === 'Camera') return 3;
  if (department === 'Editing') return 4;
  if (department === 'Sound') return 5;

  return 6;
}
