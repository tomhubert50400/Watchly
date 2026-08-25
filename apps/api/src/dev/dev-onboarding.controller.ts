import {
  BadRequestException,
  Controller,
  ForbiddenException,
  Inject,
  Param,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from '../auth/auth.guard';
import { AuthService } from '../auth/auth.service';
import { AuthenticatedRequest } from '../auth/auth.types';
import { PrismaService } from '../database/prisma.service';

type OnboardingResetMode = 'full' | 'legacy';

@Controller('dev/onboarding')
@UseGuards(AuthGuard)
export class DevOnboardingController {
  constructor(
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(ConfigService) private readonly config: ConfigService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  @Post(':mode/reset')
  async reset(
    @Req() request: AuthenticatedRequest,
    @Param('mode') modeValue: string,
  ) {
    assertOnboardingResetEnvironment(this.config.get<string>('APP_ENV'));

    if (!request.authIdentity) {
      throw new UnauthorizedException('Missing auth token.');
    }

    const mode = parseResetMode(modeValue);
    const user = await this.auth.getOrCreateUser(request.authIdentity);

    return this.prisma.withConnectionRetry(() =>
      this.prisma.user.update({
        data: {
          handle: null,
          onboardingCompleted: mode === 'legacy',
        },
        select: {
          handle: true,
          id: true,
          onboardingCompleted: true,
        },
        where: { id: user.id },
      }),
    );
  }
}

export function assertOnboardingResetEnvironment(appEnvironment: string | undefined) {
  if (appEnvironment !== 'development' && appEnvironment !== 'staging') {
    throw new ForbiddenException('Onboarding reset is unavailable in production.');
  }
}

function parseResetMode(value: string): OnboardingResetMode {
  if (value === 'full' || value === 'legacy') return value;

  throw new BadRequestException('Onboarding reset mode must be full or legacy.');
}
