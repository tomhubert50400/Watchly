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

export type CatalogueSearchType = 'all' | 'movie' | 'series';

type TmdbSearchResult = {
  first_air_date?: string;
  id: number;
  media_type?: string;
  name?: string;
  overview?: string;
  poster_path?: string | null;
  release_date?: string;
  title?: string;
  vote_average?: number;
};

type TmdbSearchResponse = {
  results?: TmdbSearchResult[];
};

type TmdbMovieDetailsResponse = {
  backdrop_path?: string | null;
  genres?: { id: number; name: string }[];
  id: number;
  overview?: string;
  poster_path?: string | null;
  release_date?: string;
  runtime?: number | null;
  status?: string;
  tagline?: string;
  title?: string;
  vote_average?: number;
};

type TmdbSeriesDetailsResponse = {
  backdrop_path?: string | null;
  first_air_date?: string;
  genres?: { id: number; name: string }[];
  id: number;
  in_production?: boolean;
  name?: string;
  number_of_episodes?: number;
  number_of_seasons?: number;
  overview?: string;
  poster_path?: string | null;
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
  episode_number: number;
  id: number;
  name?: string;
  overview?: string;
  runtime?: number | null;
  season_number: number;
  still_path?: string | null;
  vote_average?: number;
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
  private readonly watchlyRatingThreshold = 100;
  private readonly imageBaseUrl = 'https://image.tmdb.org/t/p/w342';
  private readonly backdropBaseUrl = 'https://image.tmdb.org/t/p/w780';
  private readonly tmdbBaseUrl = 'https://api.themoviedb.org/3';

  constructor(
    @Inject(ConfigService) private readonly config: ConfigService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

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

  async trending() {
    const accessToken = this.getAccessToken();
    const params = new URLSearchParams({ language: 'fr-FR' });
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
    const trendingParams = new URLSearchParams({ language: 'fr-FR', page: '1' });
    const upcomingPages = [1, 2, 3, 4, 5];
    const [trendingPayload, ...upcomingPayloads] = await Promise.all([
      this.fetchTmdb<TmdbSearchResponse>(
        `${this.tmdbBaseUrl}/trending/movie/day?${trendingParams.toString()}`,
        accessToken,
        'trending movies',
      ),
      ...upcomingPages.map((page) =>
        this.fetchTmdb<TmdbSearchResponse>(
          `${this.tmdbBaseUrl}/movie/upcoming?${new URLSearchParams({
            language: 'fr-FR',
            page: String(page),
          }).toString()}`,
          accessToken,
          'announced movies',
        ),
      ),
    ]);

    return {
      announced: upcomingPayloads
        .flatMap((payload) => payload.results ?? [])
        .map((item) => this.toCatalogueItem(item, 'movie'))
        .filter((item): item is CatalogueSearchItem => Boolean(item))
        .filter((item) => isAfterMinimumAnnouncedDate(item.releaseDate))
        .sort((left, right) => getDateSortValue(left.releaseDate) - getDateSortValue(right.releaseDate))
        .slice(0, 10),
      provider: 'tmdb',
      trending: (trendingPayload.results ?? [])
        .map((item) => this.toCatalogueItem(item, 'movie'))
        .filter((item): item is CatalogueSearchItem => Boolean(item))
        .filter((item) => isReleasedDate(item.releaseDate))
        .sort((left, right) => getDateSortValue(right.releaseDate) - getDateSortValue(left.releaseDate))
        .slice(0, 10),
    };
  }

  async getMovie(tmdbId: number) {
    const accessToken = this.getAccessToken();
    const params = new URLSearchParams({ language: 'fr-FR' });
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
    const params = new URLSearchParams({ language: 'fr-FR' });
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
    const params = new URLSearchParams({ language: 'fr-FR' });
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
    const params = new URLSearchParams({ language: 'fr-FR' });
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
      language: 'fr-FR',
      page: '1',
      query,
    });

    const endpointType = mediaType === 'series' ? 'tv' : 'movie';

    return `${this.tmdbBaseUrl}/search/${endpointType}?${params.toString()}`;
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

    if (!title) {
      return null;
    }

    const posterUrl = item.poster_path ? `${this.imageBaseUrl}${item.poster_path}` : null;

    return {
      id: `${mediaType}:${item.id}`,
      mediaType,
      overview: item.overview ?? '',
      posterUrl,
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
    return {
      backdropUrl: item.backdrop_path ? `${this.backdropBaseUrl}${item.backdrop_path}` : null,
      displayRating,
      genres: item.genres?.map((genre) => genre.name).filter(Boolean) ?? [],
      id: `movie:${item.id}`,
      mediaType: 'movie',
      overview: item.overview ?? '',
      posterUrl: item.poster_path ? `${this.imageBaseUrl}${item.poster_path}` : null,
      releaseDate: item.release_date ?? null,
      runtimeMinutes: typeof item.runtime === 'number' ? item.runtime : null,
      status: item.status ?? null,
      tagline: item.tagline || null,
      title: item.title ?? '',
      tmdbId: item.id,
      voteAverage: typeof item.vote_average === 'number' ? item.vote_average : null,
    };
  }

  private toSeriesDetails(item: TmdbSeriesDetailsResponse): SeriesDetails {
    return {
      backdropUrl: item.backdrop_path ? `${this.backdropBaseUrl}${item.backdrop_path}` : null,
      firstAirDate: item.first_air_date ?? null,
      genres: item.genres?.map((genre) => genre.name).filter(Boolean) ?? [],
      id: `series:${item.id}`,
      inProduction: Boolean(item.in_production),
      mediaType: 'series',
      numberOfEpisodes: typeof item.number_of_episodes === 'number' ? item.number_of_episodes : null,
      numberOfSeasons: typeof item.number_of_seasons === 'number' ? item.number_of_seasons : null,
      overview: item.overview ?? '',
      posterUrl: item.poster_path ? `${this.imageBaseUrl}${item.poster_path}` : null,
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

function isAfterMinimumAnnouncedDate(value: string | null) {
  return typeof value === 'string' && value > getDateKeyFromNow(3);
}

function getTodayDateKey() {
  return new Date().toISOString().slice(0, 10);
}

function getDateKeyFromNow(days: number) {
  const date = new Date();

  date.setUTCDate(date.getUTCDate() + days);

  return date.toISOString().slice(0, 10);
}
