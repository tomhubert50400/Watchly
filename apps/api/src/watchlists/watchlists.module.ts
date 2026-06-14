import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaService } from '../database/prisma.service';
import { WatchlistsController } from './watchlists.controller';
import { WatchlistsService } from './watchlists.service';

@Module({
  controllers: [WatchlistsController],
  imports: [AuthModule],
  providers: [WatchlistsService, PrismaService],
})
export class WatchlistsModule {}
