import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaService } from '../database/prisma.service';
import { BlocksController } from './blocks.controller';
import { BlocksService } from './blocks.service';

@Module({
  controllers: [BlocksController],
  imports: [AuthModule],
  providers: [BlocksService, PrismaService],
})
export class BlocksModule {}
