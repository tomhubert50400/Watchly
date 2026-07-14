import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Post,
  Put,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { AuthenticatedRequest } from '../auth/auth.types';
import {
  CreateSharedWatchlistDto,
  CreateVotingSessionDto,
  SharedWatchlistContentType,
  sharedWatchlistContentTypes,
  SharedWatchlistItemDto,
  SharedWatchlistMemberDto,
} from './shared-watchlists.dto';
import { SharedWatchlistsService } from './shared-watchlists.service';

@Controller('shared-watchlists')
@UseGuards(AuthGuard)
export class SharedWatchlistsController {
  constructor(@Inject(SharedWatchlistsService) private readonly watchlists: SharedWatchlistsService) {}

  @Get()
  async list(
    @Req() request: AuthenticatedRequest,
    @Query('contentType') contentType?: string,
    @Query('tmdbId') tmdbId?: string,
  ) {
    if (contentType !== undefined || tmdbId !== undefined) {
      if (!contentType || !tmdbId) {
        throw new BadRequestException('contentType and tmdbId are required together.');
      }

      return this.watchlists.listSharedWatchlists(
        getIdentity(request),
        parseContentType(contentType),
        parseTmdbId(tmdbId),
      );
    }

    return this.watchlists.listSharedWatchlists(getIdentity(request));
  }

  @Post()
  async create(@Req() request: AuthenticatedRequest, @Body() body: CreateSharedWatchlistDto) {
    return this.watchlists.createSharedWatchlist(getIdentity(request), body.name);
  }

  @Get(':watchlistId')
  async get(@Req() request: AuthenticatedRequest, @Param('watchlistId') watchlistId: string) {
    return this.watchlists.getSharedWatchlist(getIdentity(request), parseUuid(watchlistId, 'watchlistId'));
  }

  @Delete(':watchlistId')
  async delete(@Req() request: AuthenticatedRequest, @Param('watchlistId') watchlistId: string) {
    await this.watchlists.deleteSharedWatchlist(getIdentity(request), parseUuid(watchlistId, 'watchlistId'));

    return { deleted: true };
  }

  @Put(':watchlistId/members')
  async addMember(
    @Req() request: AuthenticatedRequest,
    @Param('watchlistId') watchlistId: string,
    @Body() body: SharedWatchlistMemberDto,
  ) {
    return this.watchlists.addMember(
      getIdentity(request),
      parseUuid(watchlistId, 'watchlistId'),
      body.userId,
    );
  }

  @Put(':watchlistId/items')
  async addItem(
    @Req() request: AuthenticatedRequest,
    @Param('watchlistId') watchlistId: string,
    @Body() body: SharedWatchlistItemDto,
  ) {
    return this.watchlists.addItem(getIdentity(request), parseUuid(watchlistId, 'watchlistId'), body);
  }

  @Delete(':watchlistId/items')
  async removeItem(
    @Req() request: AuthenticatedRequest,
    @Param('watchlistId') watchlistId: string,
    @Query('contentType') contentType?: string,
    @Query('tmdbId') tmdbId?: string,
  ) {
    if (!contentType || !tmdbId) {
      throw new BadRequestException('contentType and tmdbId are required.');
    }

    await this.watchlists.removeItem(
      getIdentity(request),
      parseUuid(watchlistId, 'watchlistId'),
      parseContentType(contentType),
      parseTmdbId(tmdbId),
    );

    return { deleted: true };
  }

  @Post(':watchlistId/voting-sessions')
  async createVotingSession(
    @Req() request: AuthenticatedRequest,
    @Param('watchlistId') watchlistId: string,
    @Body() body: CreateVotingSessionDto,
  ) {
    return this.watchlists.createVotingSession(
      getIdentity(request),
      parseUuid(watchlistId, 'watchlistId'),
      body.title,
      body.itemIds,
    );
  }

  @Put(':watchlistId/voting-sessions/:sessionId/close')
  async closeVotingSession(
    @Req() request: AuthenticatedRequest,
    @Param('watchlistId') watchlistId: string,
    @Param('sessionId') sessionId: string,
  ) {
    return this.watchlists.closeVotingSession(
      getIdentity(request),
      parseUuid(watchlistId, 'watchlistId'),
      parseUuid(sessionId, 'sessionId'),
    );
  }

  @Put(':watchlistId/voting-sessions/:sessionId/candidates/:candidateId/vote')
  async vote(
    @Req() request: AuthenticatedRequest,
    @Param('watchlistId') watchlistId: string,
    @Param('sessionId') sessionId: string,
    @Param('candidateId') candidateId: string,
  ) {
    return this.watchlists.voteForCandidate(
      getIdentity(request),
      parseUuid(watchlistId, 'watchlistId'),
      parseUuid(sessionId, 'sessionId'),
      parseUuid(candidateId, 'candidateId'),
    );
  }

  @Delete(':watchlistId/voting-sessions/:sessionId/candidates/:candidateId/vote')
  async removeVote(
    @Req() request: AuthenticatedRequest,
    @Param('watchlistId') watchlistId: string,
    @Param('sessionId') sessionId: string,
    @Param('candidateId') candidateId: string,
  ) {
    return this.watchlists.removeVote(
      getIdentity(request),
      parseUuid(watchlistId, 'watchlistId'),
      parseUuid(sessionId, 'sessionId'),
      parseUuid(candidateId, 'candidateId'),
    );
  }
}

function getIdentity(request: AuthenticatedRequest) {
  if (!request.authIdentity) {
    throw new UnauthorizedException('Missing auth token.');
  }

  return request.authIdentity;
}

function parseUuid(value: string, label: string) {
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  if (!uuidPattern.test(value)) {
    throw new BadRequestException(`${label} must be a valid UUID.`);
  }

  return value;
}

function parseContentType(value: string): SharedWatchlistContentType {
  if (sharedWatchlistContentTypes.includes(value as SharedWatchlistContentType)) {
    return value as SharedWatchlistContentType;
  }

  throw new BadRequestException('contentType must be movie or series.');
}

function parseTmdbId(value: string) {
  const tmdbId = Number(value);

  if (!Number.isInteger(tmdbId) || tmdbId < 1) {
    throw new BadRequestException('tmdbId must be a positive integer.');
  }

  return tmdbId;
}
