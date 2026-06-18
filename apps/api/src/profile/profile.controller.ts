import {
  Body,
  Controller,
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

  @Get('me/public-preview')
  async publicPreview(@Req() request: AuthenticatedRequest) {
    return this.profile.getOwnPublicProfilePreview(getIdentity(request));
  }

  @Get('me/opinions')
  async opinions(@Req() request: AuthenticatedRequest) {
    return this.profile.listOwnOpinions(getIdentity(request));
  }

  @Put('dev-test-user')
  async devTestUser(@Req() request: AuthenticatedRequest) {
    return this.profile.getOrCreateDevTestUser(getIdentity(request));
  }

  @Get('users/:userId')
  async publicProfile(
    @Req() request: AuthenticatedRequest,
    @Param('userId') userId: string,
  ) {
    return this.profile.getPublicProfile(getIdentity(request), userId);
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

  @Put('me/onboarding-completed')
  async completeOnboarding(@Req() request: AuthenticatedRequest) {
    return this.profile.completeOnboarding(getIdentity(request));
  }
}

function getIdentity(request: AuthenticatedRequest) {
  if (!request.authIdentity) {
    throw new UnauthorizedException('Missing auth token.');
  }

  return request.authIdentity;
}
