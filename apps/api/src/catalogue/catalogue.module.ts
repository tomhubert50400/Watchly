import { Module } from '@nestjs/common';
import { CatalogueController } from './catalogue.controller';
import { PrismaService } from '../database/prisma.service';
import { TmdbCatalogueService } from './tmdb-catalogue.service';
import { AuthModule } from '../auth/auth.module';
import { DiscoverController } from './discover.controller';
import { DiscoverService } from './discover.service';

@Module({
  controllers: [CatalogueController, DiscoverController],
  imports: [AuthModule],
  exports: [TmdbCatalogueService],
  providers: [PrismaService, TmdbCatalogueService, DiscoverService],
})
export class CatalogueModule {}
