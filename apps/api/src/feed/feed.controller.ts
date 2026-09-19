import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { AuthenticatedRequest } from '../auth/auth.types';
import { FeedService } from './feed.service';
import { CreateReviewReplyDto } from './feed.dto';

@Controller('feed')
@UseGuards(AuthGuard)
export class FeedController {
  constructor(@Inject(FeedService) private readonly feed: FeedService) {}

  @Get()
  async list(@Req() request: AuthenticatedRequest) {
    return this.feed.listFeed(getIdentity(request));
  }

  @Get('community')
  async community(@Req() request: AuthenticatedRequest, @Query('cursor') cursor?: string, @Query('mode') mode = 'for-you') {
    if (mode !== 'for-you' && mode !== 'following') throw new BadRequestException('Invalid community mode.');
    return this.feed.listCommunity(getIdentity(request), cursor, mode);
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

  @Get(':reviewCollection/:reviewId/replies')
  async listReviewReplies(
    @Req() request: AuthenticatedRequest,
    @Param('reviewCollection') reviewCollection: string,
    @Param('reviewId', ParseUUIDPipe) reviewId: string,
    @Query('cursor') cursor?: string,
  ) {
    return this.feed.listReviewReplies(
      getIdentity(request),
      parseReviewCollection(reviewCollection),
      reviewId,
      parseOptionalUuid(cursor, 'cursor'),
    );
  }

  @Post(':reviewCollection/:reviewId/replies')
  async createReviewReply(
    @Req() request: AuthenticatedRequest,
    @Param('reviewCollection') reviewCollection: string,
    @Param('reviewId', ParseUUIDPipe) reviewId: string,
    @Body() body: CreateReviewReplyDto,
  ) {
    return this.feed.createReviewReply(
      getIdentity(request),
      parseReviewCollection(reviewCollection),
      reviewId,
      body,
    );
  }

  @Delete('review-replies/:replyId')
  async deleteReviewReply(
    @Req() request: AuthenticatedRequest,
    @Param('replyId', ParseUUIDPipe) replyId: string,
  ) {
    return this.feed.deleteReviewReply(getIdentity(request), replyId);
  }
}

function parseReviewCollection(value: string) {
  if (value === 'movie-reviews') return 'movieReview' as const;
  if (value === 'episode-reviews') return 'episodeReview' as const;
  throw new BadRequestException('Invalid review collection.');
}

function parseOptionalUuid(value: string | undefined, label: string) {
  if (value === undefined) return undefined;
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidPattern.test(value)) throw new BadRequestException(`${label} must be a valid UUID.`);
  return value;
}

function getIdentity(request: AuthenticatedRequest) {
  if (!request.authIdentity) {
    throw new UnauthorizedException('Missing auth token.');
  }

  return request.authIdentity;
}
