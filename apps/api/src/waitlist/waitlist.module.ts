import { Module } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { WaitlistController } from './waitlist.controller';
import { WaitlistService } from './waitlist.service';

@Module({
  controllers: [WaitlistController],
  providers: [PrismaService, WaitlistService],
})
export class WaitlistModule {}
