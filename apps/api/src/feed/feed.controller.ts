import { Controller, Get, Inject, Req, UnauthorizedException, UseGuards } from '@nestjs/common';
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
}

function getIdentity(request: AuthenticatedRequest) {
  if (!request.authIdentity) {
    throw new UnauthorizedException('Missing auth token.');
  }

  return request.authIdentity;
}
