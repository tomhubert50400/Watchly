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
  CreateWatchlistDto,
  WatchlistContentType,
  watchlistContentTypes,
  WatchlistItemDto,
} from './watchlists.dto';
import { WatchlistsService } from './watchlists.service';

@Controller('watchlists')
@UseGuards(AuthGuard)
export class WatchlistsController {
  constructor(@Inject(WatchlistsService) private readonly watchlists: WatchlistsService) {}

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

      return this.watchlists.listWatchlists(
        getIdentity(request),
        parseContentType(contentType),
        parseTmdbId(tmdbId),
      );
    }

    return this.watchlists.listWatchlists(getIdentity(request));
  }

  @Post()
  async create(@Req() request: AuthenticatedRequest, @Body() body: CreateWatchlistDto) {
    return this.watchlists.createWatchlist(getIdentity(request), body.name);
  }

  @Get(':watchlistId')
  async get(@Req() request: AuthenticatedRequest, @Param('watchlistId') watchlistId: string) {
    return this.watchlists.getWatchlist(getIdentity(request), parseWatchlistId(watchlistId));
  }

  @Delete(':watchlistId')
  async delete(@Req() request: AuthenticatedRequest, @Param('watchlistId') watchlistId: string) {
    await this.watchlists.deleteWatchlist(getIdentity(request), parseWatchlistId(watchlistId));

    return { deleted: true };
  }

  @Put(':watchlistId/items')
  async addItem(
    @Req() request: AuthenticatedRequest,
    @Param('watchlistId') watchlistId: string,
    @Body() body: WatchlistItemDto,
  ) {
    return this.watchlists.addItem(getIdentity(request), parseWatchlistId(watchlistId), body);
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
      parseWatchlistId(watchlistId),
      parseContentType(contentType),
      parseTmdbId(tmdbId),
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

function parseWatchlistId(value: string) {
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  if (!uuidPattern.test(value)) {
    throw new BadRequestException('watchlistId must be a valid UUID.');
  }

  return value;
}

function parseContentType(value: string): WatchlistContentType {
  if (watchlistContentTypes.includes(value as WatchlistContentType)) {
    return value as WatchlistContentType;
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
