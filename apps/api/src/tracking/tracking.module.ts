import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaService } from '../database/prisma.service';
import { TrackingController } from './tracking.controller';
import { TrackingService } from './tracking.service';
import { ViewingsModule } from '../viewings/viewings.module';

@Module({
  controllers: [TrackingController],
  imports: [AuthModule, ViewingsModule],
  providers: [PrismaService, TrackingService],
})
export class TrackingModule {}
