import { Module } from '@nestjs/common';
import { CatalogueModule } from '../catalogue/catalogue.module';
import { PrismaService } from '../database/prisma.service';
import { ReleaseEventsService } from './release-events.service';

@Module({
  exports: [ReleaseEventsService],
  imports: [CatalogueModule],
  providers: [PrismaService, ReleaseEventsService],
})
export class ReleaseEventsModule {}
