import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Put,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { AuthenticatedRequest } from '../auth/auth.types';
import { ProgressService } from './progress.service';

@Controller('progress/series')
@UseGuards(AuthGuard)
export class SeriesProgressController {
  constructor(@Inject(ProgressService) private readonly progress: ProgressService) {}

  @Get()
  async listSeries(@Req() request: AuthenticatedRequest) {
    return this.progress.listSeriesProgressSummaries(getIdentity(request));
  }
}

@Controller('progress/episodes')
@UseGuards(AuthGuard)
export class EpisodeProgressController {
  constructor(@Inject(ProgressService) private readonly progress: ProgressService) {}

  @Get(':seriesTmdbId')
  async listSeries(
    @Req() request: AuthenticatedRequest,
    @Param('seriesTmdbId') seriesTmdbId: string,
  ) {
    return this.progress.listSeriesProgress(getIdentity(request), parseTmdbId(seriesTmdbId));
  }

  @Get(':seriesTmdbId/seasons/:seasonNumber')
  async listSeason(
    @Req() request: AuthenticatedRequest,
    @Param('seriesTmdbId') seriesTmdbId: string,
    @Param('seasonNumber') seasonNumber: string,
  ) {
    return this.progress.listSeasonProgress(
      getIdentity(request),
      parseTmdbId(seriesTmdbId),
      parseSeasonNumber(seasonNumber),
    );
  }

  @Get(':seriesTmdbId/seasons/:seasonNumber/episodes/:episodeNumber')
  async getEpisode(
    @Req() request: AuthenticatedRequest,
    @Param('seriesTmdbId') seriesTmdbId: string,
    @Param('seasonNumber') seasonNumber: string,
    @Param('episodeNumber') episodeNumber: string,
  ) {
    return this.progress.getEpisodeProgress(
      getIdentity(request),
      parseTmdbId(seriesTmdbId),
      parseSeasonNumber(seasonNumber),
      parseEpisodeNumber(episodeNumber),
    );
  }

  @Put(':seriesTmdbId/seasons/:seasonNumber/episodes/:episodeNumber')
  async markWatched(
    @Req() request: AuthenticatedRequest,
    @Param('seriesTmdbId') seriesTmdbId: string,
    @Param('seasonNumber') seasonNumber: string,
    @Param('episodeNumber') episodeNumber: string,
  ) {
    return this.progress.markEpisodeWatched(
      getIdentity(request),
      parseTmdbId(seriesTmdbId),
      parseSeasonNumber(seasonNumber),
      parseEpisodeNumber(episodeNumber),
    );
  }

  @Delete(':seriesTmdbId/seasons/:seasonNumber/episodes/:episodeNumber')
  async clear(
    @Req() request: AuthenticatedRequest,
    @Param('seriesTmdbId') seriesTmdbId: string,
    @Param('seasonNumber') seasonNumber: string,
    @Param('episodeNumber') episodeNumber: string,
  ) {
    await this.progress.clearEpisodeProgress(
      getIdentity(request),
      parseTmdbId(seriesTmdbId),
      parseSeasonNumber(seasonNumber),
      parseEpisodeNumber(episodeNumber),
    );

    return { deleted: true };
  }
}

function getIdentity(request: AuthenticatedRequest) {
  if (!request.authIdentity) {
    throw new UnauthorizedException('Missing auth token.');
  }

  return request.authIdentity;
}

function parseTmdbId(value: string) {
  const tmdbId = Number(value);

  if (!Number.isInteger(tmdbId) || tmdbId < 1) {
    throw new BadRequestException('tmdbId must be a positive integer.');
  }

  return tmdbId;
}

function parseSeasonNumber(value: string) {
  const seasonNumber = Number(value);

  if (!Number.isInteger(seasonNumber) || seasonNumber < 0) {
    throw new BadRequestException('seasonNumber must be a non-negative integer.');
  }

  return seasonNumber;
}

function parseEpisodeNumber(value: string) {
  const episodeNumber = Number(value);

  if (!Number.isInteger(episodeNumber) || episodeNumber < 1) {
    throw new BadRequestException('episodeNumber must be a positive integer.');
  }

  return episodeNumber;
}
