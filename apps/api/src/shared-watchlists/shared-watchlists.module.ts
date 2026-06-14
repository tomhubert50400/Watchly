import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaService } from '../database/prisma.service';
import { SharedWatchlistsController } from './shared-watchlists.controller';
import { SharedWatchlistsService } from './shared-watchlists.service';

@Module({
  controllers: [SharedWatchlistsController],
  imports: [AuthModule],
  providers: [PrismaService, SharedWatchlistsService],
  exports: [SharedWatchlistsService],
})
export class SharedWatchlistsModule {}
