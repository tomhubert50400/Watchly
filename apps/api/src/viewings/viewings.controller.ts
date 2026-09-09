import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  Put,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { AuthenticatedRequest } from '../auth/auth.types';
import { ViewingsService } from './viewings.service';
import { SaveViewingHistoryDto } from './viewing-history.dto';

@Controller('viewings')
@UseGuards(AuthGuard)
export class ViewingsController {
  constructor(@Inject(ViewingsService) private readonly viewings: ViewingsService) {}

  @Put('history')
  saveHistory(@Req() request: AuthenticatedRequest, @Body() input: SaveViewingHistoryDto) {
    return this.viewings.saveHistory(getIdentity(request), input);
  }

  @Get('stats')
  getStats(@Req() request: AuthenticatedRequest) {
    return this.viewings.getStats(getIdentity(request));
  }

  @Get('journal')
  getJournal(@Req() request: AuthenticatedRequest) {
    return this.viewings.listJournal(getIdentity(request));
  }

  @Get('movies/:tmdbId')
  getMovie(@Req() request: AuthenticatedRequest, @Param('tmdbId') tmdbId: string) {
    return this.viewings.getMovieSummary(getIdentity(request), parsePositiveInteger(tmdbId, 'tmdbId'));
  }

  @Post('movies/:tmdbId')
  logMovie(@Req() request: AuthenticatedRequest, @Param('tmdbId') tmdbId: string) {
    return this.viewings.logMovieViewing(getIdentity(request), parsePositiveInteger(tmdbId, 'tmdbId'));
  }

  @Get('series/:seriesTmdbId')
  getSeries(@Req() request: AuthenticatedRequest, @Param('seriesTmdbId') seriesTmdbId: string) {
    return this.viewings.getSeriesSummary(
      getIdentity(request),
      parsePositiveInteger(seriesTmdbId, 'seriesTmdbId'),
    );
  }

  @Get('episodes/:seriesTmdbId/seasons/:seasonNumber/episodes/:episodeNumber')
  getEpisode(
    @Req() request: AuthenticatedRequest,
    @Param('seriesTmdbId') seriesTmdbId: string,
    @Param('seasonNumber') seasonNumber: string,
    @Param('episodeNumber') episodeNumber: string,
  ) {
    return this.viewings.getEpisodeSummary(
      getIdentity(request),
      parsePositiveInteger(seriesTmdbId, 'seriesTmdbId'),
      parseNonNegativeInteger(seasonNumber, 'seasonNumber'),
      parsePositiveInteger(episodeNumber, 'episodeNumber'),
    );
  }

  @Post('episodes/:seriesTmdbId/seasons/:seasonNumber/episodes/:episodeNumber')
  logEpisode(
    @Req() request: AuthenticatedRequest,
    @Param('seriesTmdbId') seriesTmdbId: string,
    @Param('seasonNumber') seasonNumber: string,
    @Param('episodeNumber') episodeNumber: string,
  ) {
    return this.viewings.logEpisodeViewing(
      getIdentity(request),
      parsePositiveInteger(seriesTmdbId, 'seriesTmdbId'),
      parseNonNegativeInteger(seasonNumber, 'seasonNumber'),
      parsePositiveInteger(episodeNumber, 'episodeNumber'),
    );
  }
}

function getIdentity(request: AuthenticatedRequest) {
  if (!request.authIdentity) {
    throw new UnauthorizedException('Missing auth token.');
  }

  return request.authIdentity;
}

function parsePositiveInteger(value: string, field: string) {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new BadRequestException(`${field} must be a positive integer.`);
  }

  return parsed;
}

function parseNonNegativeInteger(value: string, field: string) {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new BadRequestException(`${field} must be a non-negative integer.`);
  }

  return parsed;
}
