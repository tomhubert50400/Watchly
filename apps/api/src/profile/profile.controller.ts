import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Post,
  Put,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { AuthenticatedRequest } from '../auth/auth.types';
import {
  CompleteOnboardingDto,
  ConfirmAvatarUploadDto,
  UpdateProfileBackdropDto,
  UpdatePrivacySettingsDto,
  UpdateProfileDto,
} from './profile.dto';
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

  @Get('me/export')
  async exportAccountData(@Req() request: AuthenticatedRequest) {
    return this.profile.exportAccountData(getIdentity(request));
  }

  @Post('me/avatar-upload')
  async createAvatarUpload(@Req() request: AuthenticatedRequest) {
    return this.profile.createAvatarUpload(getIdentity(request));
  }

  @Put('me/avatar')
  async confirmAvatarUpload(
    @Req() request: AuthenticatedRequest,
    @Body() body: ConfirmAvatarUploadDto,
  ) {
    return this.profile.confirmAvatarUpload(getIdentity(request), body.objectKey);
  }

  @Delete('me/avatar')
  async removeAvatar(@Req() request: AuthenticatedRequest) {
    return this.profile.removeAvatar(getIdentity(request));
  }

  @Put('me/backdrop')
  async updateBackdrop(
    @Req() request: AuthenticatedRequest,
    @Body() body: UpdateProfileBackdropDto,
  ) {
    return this.profile.updateProfileBackdrop(getIdentity(request), body);
  }

  @Delete('me')
  async deleteAccount(@Req() request: AuthenticatedRequest) {
    await this.profile.deleteAccount(getIdentity(request));

    return { deleted: true };
  }

  @Put('dev-test-user')
  async devTestUser(@Req() request: AuthenticatedRequest) {
    return this.profile.getOrCreateDevTestUser(getIdentity(request));
  }

  @Get('search')
  async searchProfiles(
    @Req() request: AuthenticatedRequest,
    @Query('query') query?: string,
  ) {
    return this.profile.searchProfiles(getIdentity(request), query);
  }

  @Get('handle-availability')
  async handleAvailability(
    @Req() request: AuthenticatedRequest,
    @Query('handle') handle?: string,
  ) {
    return this.profile.getHandleAvailability(getIdentity(request), handle ?? '');
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
  async completeOnboarding(
    @Req() request: AuthenticatedRequest,
    @Body() body: CompleteOnboardingDto,
  ) {
    return this.profile.completeOnboarding(getIdentity(request), body.handle);
  }
}

function getIdentity(request: AuthenticatedRequest) {
  if (!request.authIdentity) {
    throw new UnauthorizedException('Missing auth token.');
  }

  return request.authIdentity;
}
