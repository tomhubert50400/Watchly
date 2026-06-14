import {
  BadGatewayException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

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
  private readonly imageBaseUrl = 'https://image.tmdb.org/t/p/w342';
  private readonly backdropBaseUrl = 'https://image.tmdb.org/t/p/w780';
  private readonly tmdbBaseUrl = 'https://api.themoviedb.org/3';

  constructor(@Inject(ConfigService) private readonly config: ConfigService) {}

  async search(query: string, type: CatalogueSearchType) {
    const accessToken = this.config.get<string>('TMDB_ACCESS_TOKEN');

    if (!accessToken) {
      throw new ServiceUnavailableException('TMDB_ACCESS_TOKEN is not configured.');
    }

    const endpoint = this.buildSearchEndpoint(query);
    let response: Response;

    try {
      response = await fetch(endpoint, {
        headers: {
          accept: 'application/json',
          authorization: `Bearer ${accessToken}`,
        },
      });
    } catch {
      throw new BadGatewayException('Could not reach TMDB.');
    }

    if (!response.ok) {
      throw new BadGatewayException('TMDB search request failed.');
    }

    const payload = (await response.json()) as TmdbSearchResponse;
    const results = payload.results ?? [];

    return {
      items: results
        .map((item) => this.toCatalogueItem(item))
        .filter((item): item is CatalogueSearchItem => Boolean(item))
        .filter((item) => type === 'all' || item.mediaType === type),
      provider: 'tmdb',
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
      item: this.toMovieDetails(payload),
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

  private buildSearchEndpoint(query: string) {
    const params = new URLSearchParams({
      include_adult: 'false',
      language: 'fr-FR',
      page: '1',
      query,
    });

    return `${this.tmdbBaseUrl}/search/multi?${params.toString()}`;
  }

  private async fetchTmdb<T>(endpoint: string, accessToken: string, label: string): Promise<T> {
    let response: Response;

    try {
      response = await fetch(endpoint, {
        headers: {
          accept: 'application/json',
          authorization: `Bearer ${accessToken}`,
        },
      });
    } catch {
      throw new BadGatewayException('Could not reach TMDB.');
    }

    if (response.status === 404) {
      throw new NotFoundException('TMDB item was not found.');
    }

    if (!response.ok) {
      throw new BadGatewayException(`TMDB ${label} request failed.`);
    }

    return response.json() as Promise<T>;
  }

  private getAccessToken() {
    const accessToken = this.config.get<string>('TMDB_ACCESS_TOKEN');

    if (!accessToken) {
      throw new ServiceUnavailableException('TMDB_ACCESS_TOKEN is not configured.');
    }

    return accessToken;
  }

  private toCatalogueItem(item: TmdbSearchResult): CatalogueSearchItem | null {
    if (item.media_type !== 'movie' && item.media_type !== 'tv') {
      return null;
    }

    const mediaType = item.media_type === 'movie' ? 'movie' : 'series';
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

  private toMovieDetails(item: TmdbMovieDetailsResponse): MovieDetails {
    return {
      backdropUrl: item.backdrop_path ? `${this.backdropBaseUrl}${item.backdrop_path}` : null,
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
