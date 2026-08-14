import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaService } from '../database/prisma.service';
import { ExpoPushGateway } from './expo-push.gateway';
import { PushController } from './push.controller';
import { PushService } from './push.service';

@Module({
  controllers: [PushController],
  exports: [PushService],
  imports: [AuthModule],
  providers: [ExpoPushGateway, PrismaService, PushService],
})
export class PushModule {}
