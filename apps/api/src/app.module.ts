import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import Joi from 'joi';
import { AuthModule } from './auth/auth.module';
import { BlocksModule } from './blocks/blocks.module';
import { CatalogueModule } from './catalogue/catalogue.module';
import { DevModule } from './dev/dev.module';
import { FeedModule } from './feed/feed.module';
import { FollowsModule } from './follows/follows.module';
import { HealthController } from './health.controller';
import { ImportsModule } from './imports/imports.module';
import { MediaModule } from './media/media.module';
import { MonitoringController } from './observability/monitoring.controller';
import { NotificationsModule } from './notifications/notifications.module';
import { ProgressModule } from './progress/progress.module';
import { ProfileModule } from './profile/profile.module';
import { ProxyAwareThrottlerGuard } from './security/proxy-aware-throttler.guard';
import { RatingsModule } from './ratings/ratings.module';
import { ReportsModule } from './reports/reports.module';
import { ReleaseEventsModule } from './release-events/release-events.module';
import { ReviewsModule } from './reviews/reviews.module';
import { SharedWatchlistsModule } from './shared-watchlists/shared-watchlists.module';
import { TrackingModule } from './tracking/tracking.module';
import { WatchlistsModule } from './watchlists/watchlists.module';
import { ViewingsModule } from './viewings/viewings.module';

@Module({
  controllers: [HealthController, MonitoringController],
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({
        APP_ENV: Joi.string().valid('development', 'staging', 'production').default('development'),
        CORS_ORIGIN: Joi.string().uri().optional(),
        DATABASE_URL: Joi.string().uri().required(),
        ERROR_TRACKING_DSN: Joi.string().uri().when('APP_ENV', {
          is: Joi.valid('staging', 'production'),
          then: Joi.required(),
          otherwise: Joi.allow('').optional(),
        }),
        FIREBASE_AUTH_EMULATOR_HOST: Joi.string().allow('').optional(),
        FIREBASE_PROJECT_ID: Joi.string().required(),
        NODE_ENV: Joi.string().valid('development', 'test', 'production').default('development'),
        PORT: Joi.number().integer().min(1).max(65535).default(3000),
        RATE_LIMIT_MAX_REQUESTS: Joi.number().integer().min(1).default(100),
        RATE_LIMIT_TTL_MS: Joi.number().integer().min(1000).default(60000),
        MONITORING_TEST_KEY: Joi.string().min(32).when('APP_ENV', {
          is: 'staging',
          then: Joi.required(),
          otherwise: Joi.allow('').optional(),
        }),
        R2_ACCESS_KEY_ID: Joi.string().allow('').optional(),
        R2_ACCOUNT_ID: Joi.string().allow('').optional(),
        R2_BUCKET_NAME: Joi.string().allow('').optional(),
        R2_PUBLIC_BASE_URL: Joi.string().uri().allow('').optional(),
        R2_SECRET_ACCESS_KEY: Joi.string().allow('').optional(),
        TMDB_ACCESS_TOKEN: Joi.string().allow('').optional(),
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
    BlocksModule,
    CatalogueModule,
    DevModule,
    FeedModule,
    FollowsModule,
    ImportsModule,
    MediaModule,
    NotificationsModule,
    ProgressModule,
    ProfileModule,
    RatingsModule,
    ReleaseEventsModule,
    ReportsModule,
    ReviewsModule,
    SharedWatchlistsModule,
    TrackingModule,
    ViewingsModule,
    WatchlistsModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ProxyAwareThrottlerGuard,
    },
  ],
})
export class AppModule {}
