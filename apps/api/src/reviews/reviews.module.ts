import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaService } from '../database/prisma.service';
import {
  EpisodeCommunityController,
  EpisodeReviewsController,
  MovieCommunityController,
  MovieReviewsController,
} from './reviews.controller';
import { ReviewsService } from './reviews.service';

@Module({
  controllers: [MovieReviewsController, MovieCommunityController, EpisodeReviewsController, EpisodeCommunityController],
  imports: [AuthModule],
  providers: [PrismaService, ReviewsService],
})
export class ReviewsModule {}
