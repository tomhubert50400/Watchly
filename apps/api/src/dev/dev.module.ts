import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaService } from '../database/prisma.service';
import { DevUiReviewController } from './dev-ui-review.controller';
import { DevUiReviewService } from './dev-ui-review.service';

@Module({
  controllers: [DevUiReviewController],
  imports: [AuthModule],
  providers: [DevUiReviewService, PrismaService],
})
export class DevModule {}
