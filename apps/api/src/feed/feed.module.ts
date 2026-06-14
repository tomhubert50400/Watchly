import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaService } from '../database/prisma.service';
import { FeedController } from './feed.controller';
import { FeedService } from './feed.service';

@Module({
  controllers: [FeedController],
  imports: [AuthModule],
  providers: [FeedService, PrismaService],
})
export class FeedModule {}
