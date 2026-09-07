import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaService } from '../database/prisma.service';
import { AuthController } from './auth.controller';
import { AdminGuard } from './admin.guard';
import { AuthGuard } from './auth.guard';
import { AuthService } from './auth.service';
import { FirebaseTokenVerifier } from './firebase-token-verifier.service';
import { ExternalOAuthService } from './external-oauth.service';
import { OptionalAuthGuard } from './optional-auth.guard';
import { DemoAuthService } from './demo-auth.service';

@Module({
  controllers: [AuthController],
  exports: [AdminGuard, AuthGuard, AuthService, FirebaseTokenVerifier, OptionalAuthGuard],
  imports: [ConfigModule],
  providers: [
    AdminGuard,
    AuthGuard,
    AuthService,
    DemoAuthService,
    ExternalOAuthService,
    FirebaseTokenVerifier,
    OptionalAuthGuard,
    PrismaService,
  ],
})
export class AuthModule {}
