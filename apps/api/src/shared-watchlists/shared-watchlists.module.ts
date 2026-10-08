import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaService } from '../database/prisma.service';
import { SharedWatchlistsController } from './shared-watchlists.controller';
import { SharedWatchlistsService } from './shared-watchlists.service';
import { WatchlistInvitationsService } from './watchlist-invitations.service';
import { CatalogueModule } from '../catalogue/catalogue.module';
import { PushModule } from '../push/push.module';

@Module({
  controllers: [SharedWatchlistsController],
  imports: [AuthModule, PushModule, CatalogueModule],
  providers: [PrismaService, SharedWatchlistsService, WatchlistInvitationsService],
  exports: [SharedWatchlistsService],
})
export class SharedWatchlistsModule {}
