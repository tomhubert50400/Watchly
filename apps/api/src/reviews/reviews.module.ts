import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaService } from '../database/prisma.service';
import {
  EpisodeCommunityController,
  EpisodeReviewsController,
  MovieReviewsController,
} from './reviews.controller';
import { ReviewsService } from './reviews.service';

@Module({
  controllers: [MovieReviewsController, EpisodeReviewsController, EpisodeCommunityController],
  imports: [AuthModule],
  providers: [PrismaService, ReviewsService],
})
export class ReviewsModule {}
