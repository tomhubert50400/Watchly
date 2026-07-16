import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaService } from '../database/prisma.service';
import { AuthController } from './auth.controller';
import { AuthGuard } from './auth.guard';
import { AuthService } from './auth.service';
import { FirebaseTokenVerifier } from './firebase-token-verifier.service';
import { OptionalAuthGuard } from './optional-auth.guard';

@Module({
  controllers: [AuthController],
  exports: [AuthGuard, AuthService, FirebaseTokenVerifier, OptionalAuthGuard],
  imports: [ConfigModule],
  providers: [AuthGuard, AuthService, FirebaseTokenVerifier, OptionalAuthGuard, PrismaService],
})
export class AuthModule {}
