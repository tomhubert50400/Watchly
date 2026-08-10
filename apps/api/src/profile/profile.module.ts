import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaService } from '../database/prisma.service';
import { ViewingsModule } from '../viewings/viewings.module';
import { ProfileController } from './profile.controller';
import { ProfileService } from './profile.service';

@Module({
  controllers: [ProfileController],
  imports: [AuthModule, ViewingsModule],
  providers: [PrismaService, ProfileService],
})
export class ProfileModule {}
