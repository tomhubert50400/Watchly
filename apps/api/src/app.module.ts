import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import Joi from 'joi';
import { AuthModule } from './auth/auth.module';
import { HealthController } from './health.controller';

@Module({
  controllers: [HealthController],
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({
        CORS_ORIGIN: Joi.string().uri().optional(),
        DATABASE_URL: Joi.string().uri().required(),
        FIREBASE_AUTH_EMULATOR_HOST: Joi.string().allow('').optional(),
        FIREBASE_PROJECT_ID: Joi.string().required(),
        NODE_ENV: Joi.string().valid('development', 'test', 'production').default('development'),
        PORT: Joi.number().integer().min(1).max(65535).default(3000),
        RATE_LIMIT_MAX_REQUESTS: Joi.number().integer().min(1).default(100),
        RATE_LIMIT_TTL_MS: Joi.number().integer().min(1000).default(60000),
      }),
    }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [
        {
          limit: config.getOrThrow<number>('RATE_LIMIT_MAX_REQUESTS'),
          ttl: config.getOrThrow<number>('RATE_LIMIT_TTL_MS'),
        },
      ],
    }),
    AuthModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
