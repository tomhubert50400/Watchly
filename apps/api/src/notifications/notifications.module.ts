import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CatalogueModule } from '../catalogue/catalogue.module';
import { PrismaService } from '../database/prisma.service';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

@Module({
  controllers: [NotificationsController],
  imports: [AuthModule, CatalogueModule],
  providers: [NotificationsService, PrismaService],
})
export class NotificationsModule {}
