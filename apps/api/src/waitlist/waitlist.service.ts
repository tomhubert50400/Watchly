import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { JoinWaitlistDto } from './waitlist.dto';

@Injectable()
export class WaitlistService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async join({ email, website }: JoinWaitlistDto) {
    if (website?.trim()) {
      return { status: 'joined' as const };
    }

    const emailNormalized = email.trim().toLowerCase();

    await this.prisma.withConnectionRetry(() =>
      this.prisma.waitlistSubscriber.upsert({
        create: { emailNormalized },
        update: {},
        where: { emailNormalized },
      }),
    );

    return { status: 'joined' as const };
  }
}
