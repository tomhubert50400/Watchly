import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaService } from '../database/prisma.service';
import { ReleaseEventsModule } from '../release-events/release-events.module';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

@Module({
  controllers: [NotificationsController],
  imports: [AuthModule, ReleaseEventsModule],
  providers: [NotificationsService, PrismaService],
})
export class NotificationsModule {}
