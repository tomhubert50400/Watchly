import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Put,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { AuthenticatedRequest } from '../auth/auth.types';
import { PushService } from './push.service';

@Controller('push')
@UseGuards(AuthGuard)
export class PushController {
  constructor(@Inject(PushService) private readonly push: PushService) {}

  @Get('preferences')
  getPreferences(@Req() request: AuthenticatedRequest) {
    return this.push.getPreferences(getIdentity(request));
  }

  @Put('preferences')
  updatePreferences(
    @Req() request: AuthenticatedRequest,
    @Body() body: Record<string, unknown> = {},
  ) {
    return this.push.updatePreferences(getIdentity(request), parsePreferences(body));
  }

  @Put('device')
  registerDevice(
    @Req() request: AuthenticatedRequest,
    @Body() body: Record<string, unknown> = {},
  ) {
    return this.push.registerDevice(
      getIdentity(request),
      parseExpoPushToken(body.expoPushToken),
      parsePlatform(body.platform),
    );
  }

  @Delete('device')
  revokeDevice(
    @Req() request: AuthenticatedRequest,
    @Body() body: Record<string, unknown> = {},
  ) {
    return this.push.revokeDevice(
      getIdentity(request),
      parseExpoPushToken(body.expoPushToken),
    );
  }
}

function getIdentity(request: AuthenticatedRequest) {
  if (!request.authIdentity) throw new UnauthorizedException('Missing auth token.');
  return request.authIdentity;
}

function parsePreferences(body: Record<string, unknown>) {
  const pushEnabled = parseOptionalBoolean(body.pushEnabled, 'pushEnabled');
  const releasePushEnabled = parseOptionalBoolean(body.releasePushEnabled, 'releasePushEnabled');
  if (pushEnabled === undefined && releasePushEnabled === undefined) {
    throw new BadRequestException('Provide at least one notification preference.');
  }
  return { pushEnabled, releasePushEnabled };
}

function parseOptionalBoolean(value: unknown, field: string) {
  if (value === undefined) return undefined;
  if (typeof value !== 'boolean') throw new BadRequestException(`${field} must be a boolean.`);
  return value;
}

function parseExpoPushToken(value: unknown) {
  if (typeof value !== 'string' || value.length > 255) {
    throw new BadRequestException('expoPushToken must be a valid Expo push token.');
  }
  return value;
}

function parsePlatform(value: unknown) {
  if (value !== 'android' && value !== 'ios') {
    throw new BadRequestException('platform must be android or ios.');
  }
  return value;
}
