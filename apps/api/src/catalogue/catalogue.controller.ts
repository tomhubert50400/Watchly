import { BadRequestException, Controller, Get, Inject, Param, ParseIntPipe, Query } from '@nestjs/common';
import {
  CatalogueDiscoveryMediaType,
  CatalogueDiscoverySection,
  CatalogueSearchType,
  TmdbCatalogueService,
} from './tmdb-catalogue.service';

@Controller('catalog')
export class CatalogueController {
  constructor(@Inject(TmdbCatalogueService) private readonly catalogue: TmdbCatalogueService) {}

  @Get('search')
  async search(@Query('query') query?: string, @Query('type') type?: string) {
    const trimmedQuery = query?.trim() ?? '';

    if (trimmedQuery.length < 2) {
      throw new BadRequestException('Search query must contain at least 2 characters.');
    }

    if (type && type !== 'all' && type !== 'movie' && type !== 'series') {
      throw new BadRequestException('Search type must be all, movie, or series.');
    }

    const searchType: CatalogueSearchType =
      type === 'movie' || type === 'series' ? type : 'all';

    return this.catalogue.search(trimmedQuery, searchType);
  }

  @Get('trending')
  async trending() {
    return this.catalogue.trending();
  }

  @Get('movie-sections')
  async movieSections() {
    return this.catalogue.movieSections();
  }

  @Get('onboarding-taste-options')
  async onboardingTasteOptions(@Query('movieGenreId') movieGenreId?: string) {
    const trimmedGenreId = movieGenreId?.trim();

    if (trimmedGenreId === undefined || trimmedGenreId === '') {
      return this.catalogue.onboardingTasteOptions();
    }

    if (!/^\d+$/.test(trimmedGenreId)) {
      throw new BadRequestException('movieGenreId must be a positive integer.');
    }

    const parsedGenreId = Number(trimmedGenreId);
    if (!Number.isSafeInteger(parsedGenreId) || parsedGenreId <= 0) {
      throw new BadRequestException('movieGenreId must be a positive integer.');
    }

    return this.catalogue.onboardingTasteOptions(parsedGenreId);
  }

  @Get('discovery')
  async discovery(@Query('section') section?: string, @Query('type') type?: string) {
    if (section !== 'trending' && section !== 'announced') {
      throw new BadRequestException('Discovery section must be trending or announced.');
    }

    if (type !== 'movie' && type !== 'series') {
      throw new BadRequestException('Discovery type must be movie or series.');
    }

    return this.catalogue.discovery(
      section as CatalogueDiscoverySection,
      type as CatalogueDiscoveryMediaType,
    );
  }

  @Get('movies/:tmdbId')
  async movieDetails(@Param('tmdbId', ParseIntPipe) tmdbId: number) {
    return this.catalogue.getMovie(tmdbId);
  }

  @Get('movies/:tmdbId/watch-providers')
  async movieWatchProviders(
    @Param('tmdbId', ParseIntPipe) tmdbId: number,
    @Query('country') country?: string,
  ) {
    return this.catalogue.getMovieWatchProviders(tmdbId, parseCountry(country));
  }

  @Get('series/:tmdbId')
  async seriesDetails(@Param('tmdbId', ParseIntPipe) tmdbId: number) {
    return this.catalogue.getSeries(tmdbId);
  }

  @Get('series/:tmdbId/watch-providers')
  async seriesWatchProviders(
    @Param('tmdbId', ParseIntPipe) tmdbId: number,
    @Query('country') country?: string,
  ) {
    return this.catalogue.getSeriesWatchProviders(tmdbId, parseCountry(country));
  }

  @Get('series/:tmdbId/seasons/:seasonNumber')
  async seasonDetails(
    @Param('tmdbId', ParseIntPipe) tmdbId: number,
    @Param('seasonNumber', ParseIntPipe) seasonNumber: number,
  ) {
    return this.catalogue.getSeason(tmdbId, seasonNumber);
  }

  @Get('series/:tmdbId/seasons/:seasonNumber/episodes/:episodeNumber')
  async episodeDetails(
    @Param('tmdbId', ParseIntPipe) tmdbId: number,
    @Param('seasonNumber', ParseIntPipe) seasonNumber: number,
    @Param('episodeNumber', ParseIntPipe) episodeNumber: number,
  ) {
    return this.catalogue.getEpisode(tmdbId, seasonNumber, episodeNumber);
  }
}

function parseCountry(value: string | undefined) {
  const country = (value?.trim() || 'US').toUpperCase();

  if (!/^[A-Z]{2}$/.test(country)) {
    throw new BadRequestException('country must be a two-letter country code.');
  }

  return country;
}
