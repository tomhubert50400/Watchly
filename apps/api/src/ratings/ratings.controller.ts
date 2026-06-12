import {
  BadRequestException,
  Body,
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
import { RatingScoreDto } from './ratings.dto';
import { RatingsService } from './ratings.service';

@Controller('ratings/movies')
@UseGuards(AuthGuard)
export class MovieRatingsController {
  constructor(@Inject(RatingsService) private readonly ratings: RatingsService) {}

  @Get()
  async list(@Req() request: AuthenticatedRequest) {
    return this.ratings.listMovieRatings(getIdentity(request));
  }

  @Get(':tmdbId')
  async get(@Req() request: AuthenticatedRequest, @Param('tmdbId') tmdbId: string) {
    return this.ratings.getMovieRating(getIdentity(request), parseTmdbId(tmdbId));
  }

  @Put(':tmdbId')
  async upsert(
    @Req() request: AuthenticatedRequest,
    @Param('tmdbId') tmdbId: string,
    @Body() body: RatingScoreDto,
  ) {
    return this.ratings.upsertMovieRating(getIdentity(request), parseTmdbId(tmdbId), body.score);
  }

  @Delete(':tmdbId')
  async delete(@Req() request: AuthenticatedRequest, @Param('tmdbId') tmdbId: string) {
    await this.ratings.deleteMovieRating(getIdentity(request), parseTmdbId(tmdbId));

    return { deleted: true };
  }
}

@Controller('ratings/episodes')
@UseGuards(AuthGuard)
export class EpisodeRatingsController {
  constructor(@Inject(RatingsService) private readonly ratings: RatingsService) {}

  @Get(':seriesTmdbId/seasons/:seasonNumber/episodes/:episodeNumber')
  async get(
    @Req() request: AuthenticatedRequest,
    @Param('seriesTmdbId') seriesTmdbId: string,
    @Param('seasonNumber') seasonNumber: string,
    @Param('episodeNumber') episodeNumber: string,
  ) {
    return this.ratings.getEpisodeRating(
      getIdentity(request),
      parseTmdbId(seriesTmdbId),
      parseSeasonNumber(seasonNumber),
      parseEpisodeNumber(episodeNumber),
    );
  }

  @Put(':seriesTmdbId/seasons/:seasonNumber/episodes/:episodeNumber')
  async upsert(
    @Req() request: AuthenticatedRequest,
    @Param('seriesTmdbId') seriesTmdbId: string,
    @Param('seasonNumber') seasonNumber: string,
    @Param('episodeNumber') episodeNumber: string,
    @Body() body: RatingScoreDto,
  ) {
    return this.ratings.upsertEpisodeRating(
      getIdentity(request),
      parseTmdbId(seriesTmdbId),
      parseSeasonNumber(seasonNumber),
      parseEpisodeNumber(episodeNumber),
      body.score,
    );
  }

  @Delete(':seriesTmdbId/seasons/:seasonNumber/episodes/:episodeNumber')
  async delete(
    @Req() request: AuthenticatedRequest,
    @Param('seriesTmdbId') seriesTmdbId: string,
    @Param('seasonNumber') seasonNumber: string,
    @Param('episodeNumber') episodeNumber: string,
  ) {
    await this.ratings.deleteEpisodeRating(
      getIdentity(request),
      parseTmdbId(seriesTmdbId),
      parseSeasonNumber(seasonNumber),
      parseEpisodeNumber(episodeNumber),
    );

    return { deleted: true };
  }
}

@Controller('ratings/series')
@UseGuards(AuthGuard)
export class SeriesRatingsController {
  constructor(@Inject(RatingsService) private readonly ratings: RatingsService) {}

  @Get(':seriesTmdbId/summary')
  async getSummary(
    @Req() request: AuthenticatedRequest,
    @Param('seriesTmdbId') seriesTmdbId: string,
  ) {
    return this.ratings.getSeriesRatingSummary(getIdentity(request), parseTmdbId(seriesTmdbId));
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
