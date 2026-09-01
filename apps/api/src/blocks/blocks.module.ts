import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaService } from '../database/prisma.service';
import { MediaModule } from '../media/media.module';
import { BlocksController } from './blocks.controller';
import { BlocksService } from './blocks.service';

@Module({
  controllers: [BlocksController],
  imports: [AuthModule, MediaModule],
  providers: [BlocksService, PrismaService],
})
export class BlocksModule {}
