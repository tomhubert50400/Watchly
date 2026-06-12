import { BadRequestException, Controller, Get, Inject, Param, ParseIntPipe, Query } from '@nestjs/common';
import { CatalogueSearchType, TmdbCatalogueService } from './tmdb-catalogue.service';

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

  @Get('movies/:tmdbId')
  async movieDetails(@Param('tmdbId', ParseIntPipe) tmdbId: number) {
    return this.catalogue.getMovie(tmdbId);
  }

  @Get('series/:tmdbId')
  async seriesDetails(@Param('tmdbId', ParseIntPipe) tmdbId: number) {
    return this.catalogue.getSeries(tmdbId);
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
