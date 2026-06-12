import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaService } from '../database/prisma.service';
import { EpisodeRatingsController, MovieRatingsController, SeriesRatingsController } from './ratings.controller';
import { RatingsService } from './ratings.service';

@Module({
  controllers: [MovieRatingsController, EpisodeRatingsController, SeriesRatingsController],
  imports: [AuthModule],
  providers: [PrismaService, RatingsService],
})
export class RatingsModule {}
