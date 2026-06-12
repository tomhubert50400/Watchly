import { Body, Controller, Get, Inject, Put, Req, UnauthorizedException, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { AuthenticatedRequest } from '../auth/auth.types';
import { UpdatePrivacySettingsDto, UpdateProfileDto } from './profile.dto';
import { ProfileService } from './profile.service';

@Controller('profile')
@UseGuards(AuthGuard)
export class ProfileController {
  constructor(@Inject(ProfileService) private readonly profile: ProfileService) {}

  @Get('me')
  async me(@Req() request: AuthenticatedRequest) {
    return this.profile.getProfile(getIdentity(request));
  }

  @Put('me')
  async updateMe(@Req() request: AuthenticatedRequest, @Body() body: UpdateProfileDto) {
    return this.profile.updateProfile(getIdentity(request), body);
  }

  @Put('privacy')
  async updatePrivacy(
    @Req() request: AuthenticatedRequest,
    @Body() body: UpdatePrivacySettingsDto,
  ) {
    return this.profile.updatePrivacy(getIdentity(request), body);
  }
}

function getIdentity(request: AuthenticatedRequest) {
  if (!request.authIdentity) {
    throw new UnauthorizedException('Missing auth token.');
  }

  return request.authIdentity;
}
