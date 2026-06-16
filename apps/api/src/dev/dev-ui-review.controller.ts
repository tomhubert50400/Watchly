import { Controller, ForbiddenException, Inject, Post, Req, UnauthorizedException, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from '../auth/auth.guard';
import { AuthenticatedRequest } from '../auth/auth.types';
import { DevUiReviewService } from './dev-ui-review.service';

@Controller('dev/ui-review-data')
@UseGuards(AuthGuard)
export class DevUiReviewController {
  constructor(
    @Inject(ConfigService) private readonly config: ConfigService,
    @Inject(DevUiReviewService) private readonly reviewData: DevUiReviewService,
  ) {}

  @Post()
  async prepare(@Req() request: AuthenticatedRequest) {
    if (this.config.get<string>('NODE_ENV') === 'production') {
      throw new ForbiddenException('Dev UI review data is disabled in production.');
    }

    if (!request.authIdentity) {
      throw new UnauthorizedException('Missing auth token.');
    }

    return this.reviewData.prepare(request.authIdentity);
  }
}
