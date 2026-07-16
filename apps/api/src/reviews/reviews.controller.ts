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
import { OptionalAuthGuard } from '../auth/optional-auth.guard';
import { ReviewBodyDto } from './reviews.dto';
import { ReviewsService } from './reviews.service';

@Controller('reviews/movies')
@UseGuards(AuthGuard)
export class MovieReviewsController {
  constructor(@Inject(ReviewsService) private readonly reviews: ReviewsService) {}

  @Get(':tmdbId')
  async get(@Req() request: AuthenticatedRequest, @Param('tmdbId') tmdbId: string) {
    return this.reviews.getMovieReview(getIdentity(request), parseTmdbId(tmdbId));
  }

  @Put(':tmdbId')
  async upsert(
    @Req() request: AuthenticatedRequest,
    @Param('tmdbId') tmdbId: string,
    @Body() body: ReviewBodyDto,
  ) {
    return this.reviews.upsertMovieReview(getIdentity(request), parseTmdbId(tmdbId), body.body);
  }

  @Delete(':tmdbId')
  async delete(@Req() request: AuthenticatedRequest, @Param('tmdbId') tmdbId: string) {
    await this.reviews.deleteMovieReview(getIdentity(request), parseTmdbId(tmdbId));

    return { deleted: true };
  }
}

@Controller('reviews/episodes')
@UseGuards(AuthGuard)
export class EpisodeReviewsController {
  constructor(@Inject(ReviewsService) private readonly reviews: ReviewsService) {}

  @Get(':seriesTmdbId/seasons/:seasonNumber/episodes/:episodeNumber')
  async get(
    @Req() request: AuthenticatedRequest,
    @Param('seriesTmdbId') seriesTmdbId: string,
    @Param('seasonNumber') seasonNumber: string,
    @Param('episodeNumber') episodeNumber: string,
  ) {
    return this.reviews.getEpisodeReview(
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
    @Body() body: ReviewBodyDto,
  ) {
    return this.reviews.upsertEpisodeReview(
      getIdentity(request),
      parseTmdbId(seriesTmdbId),
      parseSeasonNumber(seasonNumber),
      parseEpisodeNumber(episodeNumber),
      body.body,
    );
  }

  @Delete(':seriesTmdbId/seasons/:seasonNumber/episodes/:episodeNumber')
  async delete(
    @Req() request: AuthenticatedRequest,
    @Param('seriesTmdbId') seriesTmdbId: string,
    @Param('seasonNumber') seasonNumber: string,
    @Param('episodeNumber') episodeNumber: string,
  ) {
    await this.reviews.deleteEpisodeReview(
      getIdentity(request),
      parseTmdbId(seriesTmdbId),
      parseSeasonNumber(seasonNumber),
      parseEpisodeNumber(episodeNumber),
    );

    return { deleted: true };
  }
}

@Controller('community/episodes')
@UseGuards(OptionalAuthGuard)
export class EpisodeCommunityController {
  constructor(@Inject(ReviewsService) private readonly reviews: ReviewsService) {}

  @Get(':seriesTmdbId/seasons/:seasonNumber/episodes/:episodeNumber')
  async get(
    @Req() request: AuthenticatedRequest,
    @Param('seriesTmdbId') seriesTmdbId: string,
    @Param('seasonNumber') seasonNumber: string,
    @Param('episodeNumber') episodeNumber: string,
  ) {
    return this.reviews.getEpisodeCommunity(
      request.authIdentity ?? null,
      parseTmdbId(seriesTmdbId),
      parseSeasonNumber(seasonNumber),
      parseEpisodeNumber(episodeNumber),
    );
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
