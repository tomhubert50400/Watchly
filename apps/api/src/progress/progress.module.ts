import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaService } from '../database/prisma.service';
import { EpisodeProgressController, SeriesProgressController } from './progress.controller';
import { ProgressService } from './progress.service';
import { ViewingsModule } from '../viewings/viewings.module';

@Module({
  controllers: [EpisodeProgressController, SeriesProgressController],
  imports: [AuthModule, ViewingsModule],
  providers: [PrismaService, ProgressService],
})
export class ProgressModule {}
