import {
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Put,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { AuthenticatedRequest } from '../auth/auth.types';
import { BlocksService } from './blocks.service';

@Controller('blocks')
@UseGuards(AuthGuard)
export class BlocksController {
  constructor(@Inject(BlocksService) private readonly blocks: BlocksService) {}

  @Get()
  async list(
    @Req() request: AuthenticatedRequest,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
    @Query('query') query?: string,
  ) {
    return this.blocks.listBlockedUsers(getIdentity(request), cursor, limit, query);
  }

  @Get(':userId')
  async get(@Req() request: AuthenticatedRequest, @Param('userId') userId: string) {
    return this.blocks.getBlockState(getIdentity(request), userId);
  }

  @Put(':userId')
  async block(@Req() request: AuthenticatedRequest, @Param('userId') userId: string) {
    return this.blocks.blockUser(getIdentity(request), userId);
  }

  @Delete(':userId')
  async unblock(@Req() request: AuthenticatedRequest, @Param('userId') userId: string) {
    return this.blocks.unblockUser(getIdentity(request), userId);
  }
}

function getIdentity(request: AuthenticatedRequest) {
  if (!request.authIdentity) {
    throw new UnauthorizedException('Missing auth token.');
  }

  return request.authIdentity;
}
