import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Put,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { AuthenticatedRequest } from '../auth/auth.types';
import { contentTypes, TrackingContentType, UpsertContentStateDto } from './tracking.dto';
import { TrackingService } from './tracking.service';

@Controller('tracking/states')
@UseGuards(AuthGuard)
export class TrackingController {
  constructor(@Inject(TrackingService) private readonly tracking: TrackingService) {}

  @Get()
  async listOrGet(
    @Req() request: AuthenticatedRequest,
    @Query('contentType') contentType?: string,
    @Query('tmdbId') tmdbId?: string,
  ) {
    const identity = getIdentity(request);
    const parsedContentType = contentType ? parseContentType(contentType) : undefined;

    if (tmdbId !== undefined) {
      if (!parsedContentType) {
        throw new BadRequestException('contentType is required when tmdbId is provided.');
      }

      return this.tracking.getState(identity, parsedContentType, parseTmdbId(tmdbId));
    }

    return this.tracking.listStates(identity, parsedContentType);
  }

  @Put()
  async upsert(@Req() request: AuthenticatedRequest, @Body() body: UpsertContentStateDto) {
    return this.tracking.upsertState(getIdentity(request), body);
  }

  @Delete()
  async delete(
    @Req() request: AuthenticatedRequest,
    @Query('contentType') contentType?: string,
    @Query('tmdbId') tmdbId?: string,
  ) {
    if (!contentType || !tmdbId) {
      throw new BadRequestException('contentType and tmdbId are required.');
    }

    await this.tracking.deleteState(
      getIdentity(request),
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

function parseContentType(value: string): TrackingContentType {
  if (contentTypes.includes(value as TrackingContentType)) {
    return value as TrackingContentType;
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
