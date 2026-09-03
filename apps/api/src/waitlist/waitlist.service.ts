import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { isEmail } from 'class-validator';
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

    if (emailNormalized.length > 320 || !isEmail(emailNormalized)) {
      throw new BadRequestException('Enter a valid email address.');
    }

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
