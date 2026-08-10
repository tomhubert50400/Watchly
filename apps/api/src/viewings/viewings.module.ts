import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CatalogueModule } from '../catalogue/catalogue.module';
import { PrismaService } from '../database/prisma.service';
import { ViewingsController } from './viewings.controller';
import { ViewingsService } from './viewings.service';

@Module({
  controllers: [ViewingsController],
  exports: [ViewingsService],
  imports: [AuthModule, CatalogueModule],
  providers: [PrismaService, ViewingsService],
})
export class ViewingsModule {}
