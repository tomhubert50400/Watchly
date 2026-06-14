import {
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
import { FollowsService } from './follows.service';

@Controller('follows')
@UseGuards(AuthGuard)
export class FollowsController {
  constructor(@Inject(FollowsService) private readonly follows: FollowsService) {}

  @Get(':userId')
  async get(@Req() request: AuthenticatedRequest, @Param('userId') userId: string) {
    return this.follows.getFollowState(getIdentity(request), userId);
  }

  @Put(':userId')
  async follow(@Req() request: AuthenticatedRequest, @Param('userId') userId: string) {
    return this.follows.followUser(getIdentity(request), userId);
  }

  @Delete(':userId')
  async unfollow(@Req() request: AuthenticatedRequest, @Param('userId') userId: string) {
    return this.follows.unfollowUser(getIdentity(request), userId);
  }
}

function getIdentity(request: AuthenticatedRequest) {
  if (!request.authIdentity) {
    throw new UnauthorizedException('Missing auth token.');
  }

  return request.authIdentity;
}
