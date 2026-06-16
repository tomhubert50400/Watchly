import { Module } from '@nestjs/common';
import { CatalogueController } from './catalogue.controller';
import { PrismaService } from '../database/prisma.service';
import { TmdbCatalogueService } from './tmdb-catalogue.service';

@Module({
  controllers: [CatalogueController],
  exports: [TmdbCatalogueService],
  providers: [PrismaService, TmdbCatalogueService],
})
export class CatalogueModule {}
