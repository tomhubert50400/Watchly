import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaService } from '../database/prisma.service';
import { AuthController } from './auth.controller';
import { AuthGuard } from './auth.guard';
import { AuthService } from './auth.service';
import { FirebaseTokenVerifier } from './firebase-token-verifier.service';

@Module({
  controllers: [AuthController],
  exports: [AuthGuard, AuthService, FirebaseTokenVerifier],
  imports: [ConfigModule],
  providers: [AuthGuard, AuthService, FirebaseTokenVerifier, PrismaService],
})
export class AuthModule {}
