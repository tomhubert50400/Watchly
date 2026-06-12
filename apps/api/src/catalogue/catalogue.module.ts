import { Module } from '@nestjs/common';
import { CatalogueController } from './catalogue.controller';
import { TmdbCatalogueService } from './tmdb-catalogue.service';

@Module({
  controllers: [CatalogueController],
  providers: [TmdbCatalogueService],
})
export class CatalogueModule {}
