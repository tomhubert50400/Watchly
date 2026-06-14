import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaService } from '../database/prisma.service';
import { FollowsController } from './follows.controller';
import { FollowsService } from './follows.service';

@Module({
  controllers: [FollowsController],
  imports: [AuthModule],
  providers: [FollowsService, PrismaService],
})
export class FollowsModule {}
