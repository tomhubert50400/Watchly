import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CatalogueModule } from '../catalogue/catalogue.module';
import { PrismaService } from '../database/prisma.service';
import { ImportsController } from './imports.controller';
import { ImportsService } from './imports.service';

@Module({
  controllers: [ImportsController],
  imports: [AuthModule, CatalogueModule],
  providers: [ImportsService, PrismaService],
})
export class ImportsModule {}
