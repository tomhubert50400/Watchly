import {
  BadRequestException,
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
import { NotificationsService } from './notifications.service';

@Controller('notifications')
@UseGuards(AuthGuard)
export class NotificationsController {
  constructor(@Inject(NotificationsService) private readonly notifications: NotificationsService) {}

  @Get()
  async list(@Req() request: AuthenticatedRequest) {
    return this.notifications.list(getIdentity(request));
  }

  @Post('sync')
  async sync(@Req() request: AuthenticatedRequest) {
    return this.notifications.sync(getIdentity(request));
  }

  @Put(':notificationId/read')
  async markRead(
    @Req() request: AuthenticatedRequest,
    @Param('notificationId') notificationId: string,
  ) {
    return this.notifications.markRead(getIdentity(request), parseUuid(notificationId));
  }
}

function getIdentity(request: AuthenticatedRequest) {
  if (!request.authIdentity) {
    throw new UnauthorizedException('Missing auth token.');
  }

  return request.authIdentity;
}

function parseUuid(value: string) {
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  if (!uuidPattern.test(value)) {
    throw new BadRequestException('notificationId must be a valid UUID.');
  }

  return value;
}
