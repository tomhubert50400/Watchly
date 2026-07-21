import {
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Put,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { AuthenticatedRequest } from '../auth/auth.types';
import { FeedService } from './feed.service';

@Controller('feed')
@UseGuards(AuthGuard)
export class FeedController {
  constructor(@Inject(FeedService) private readonly feed: FeedService) {}

  @Get()
  async list(@Req() request: AuthenticatedRequest) {
    return this.feed.listFeed(getIdentity(request));
  }

  @Put('movie-reviews/:reviewId/like')
  async likeMovieReview(
    @Req() request: AuthenticatedRequest,
    @Param('reviewId', ParseUUIDPipe) reviewId: string,
  ) {
    return this.feed.likeMovieReview(getIdentity(request), reviewId);
  }

  @Delete('movie-reviews/:reviewId/like')
  async unlikeMovieReview(
    @Req() request: AuthenticatedRequest,
    @Param('reviewId', ParseUUIDPipe) reviewId: string,
  ) {
    return this.feed.unlikeMovieReview(getIdentity(request), reviewId);
  }

  @Put('episode-reviews/:reviewId/like')
  async likeEpisodeReview(
    @Req() request: AuthenticatedRequest,
    @Param('reviewId', ParseUUIDPipe) reviewId: string,
  ) {
    return this.feed.likeEpisodeReview(getIdentity(request), reviewId);
  }

  @Delete('episode-reviews/:reviewId/like')
  async unlikeEpisodeReview(
    @Req() request: AuthenticatedRequest,
    @Param('reviewId', ParseUUIDPipe) reviewId: string,
  ) {
    return this.feed.unlikeEpisodeReview(getIdentity(request), reviewId);
  }
}

function getIdentity(request: AuthenticatedRequest) {
  if (!request.authIdentity) {
    throw new UnauthorizedException('Missing auth token.');
  }

  return request.authIdentity;
}
