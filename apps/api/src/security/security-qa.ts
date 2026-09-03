import 'reflect-metadata';
import { Type } from '@nestjs/common';
import { GUARDS_METADATA, MODULE_METADATA } from '@nestjs/common/constants';
import { APP_GUARD } from '@nestjs/core';
import { AuthGuard } from '../auth/auth.guard';
import { OptionalAuthGuard } from '../auth/optional-auth.guard';
import { AuthController } from '../auth/auth.controller';
import { BlocksController } from '../blocks/blocks.controller';
import { CatalogueController } from '../catalogue/catalogue.controller';
import { FeedController } from '../feed/feed.controller';
import { FollowsController } from '../follows/follows.controller';
import { NotificationsController } from '../notifications/notifications.controller';
import {
  EpisodeProgressController,
  SeriesProgressController,
} from '../progress/progress.controller';
import { ProfileController } from '../profile/profile.controller';
import {
  EpisodeRatingsController,
  MovieRatingsController,
  SeriesRatingsController,
} from '../ratings/ratings.controller';
import {
  EpisodeCommunityController,
  EpisodeReviewsController,
  MovieReviewsController,
} from '../reviews/reviews.controller';
import { SharedWatchlistsController } from '../shared-watchlists/shared-watchlists.controller';
import { TrackingController } from '../tracking/tracking.controller';
import { WatchlistsController } from '../watchlists/watchlists.controller';
import { WaitlistController } from '../waitlist/waitlist.controller';
import { createEnvironmentIsolationMiddleware } from '../environment-isolation';
import {
  ProxyAwareThrottlerGuard,
  resolveThrottlerTracker,
} from './proxy-aware-throttler.guard';

type ControllerClass = Type<unknown>;

const protectedControllers = [
  BlocksController,
  FeedController,
  FollowsController,
  NotificationsController,
  EpisodeProgressController,
  SeriesProgressController,
  ProfileController,
  EpisodeRatingsController,
  MovieRatingsController,
  SeriesRatingsController,
  EpisodeReviewsController,
  MovieReviewsController,
  SharedWatchlistsController,
  TrackingController,
  WatchlistsController,
];

const publicControllers = [CatalogueController, WaitlistController];
const optionalAuthControllers = [EpisodeCommunityController];

async function main() {
  process.env.DATABASE_URL ??= 'postgresql://postgres:postgres@localhost:5432/tv_app?schema=public';
  process.env.FIREBASE_PROJECT_ID ??= 'security-qa';

  const { AppModule } = await import('../app.module.js');

  const failures = [
    ...assertProtectedControllersUseAuthGuard(),
    ...assertAuthMeUsesAuthGuard(),
    ...assertPublicControllersStayPublic(),
    ...assertOptionalAuthControllersUseOptionalAuthGuard(),
    ...assertGlobalThrottlerGuard(AppModule),
    ...assertProxyAwareThrottlerTracker(),
    ...assertEnvironmentIsolation(),
  ];

  if (failures.length > 0) {
    throw new Error(`Security QA failed:\n${failures.map((failure) => `- ${failure}`).join('\n')}`);
  }

  console.log('Security QA passed.');
}

function assertEnvironmentIsolation() {
  const failures: string[] = [];
  const middleware = createEnvironmentIsolationMiddleware('staging');

  if (runEnvironmentMiddleware(middleware, '/ratings', 'POST', 'production').statusCode !== 409) {
    failures.push('An API must reject a client from another environment.');
  }

  if (runEnvironmentMiddleware(middleware, '/ratings', 'POST', undefined).statusCode !== 409) {
    failures.push('An API must reject an application request without an environment.');
  }

  if (!runEnvironmentMiddleware(middleware, '/ratings', 'POST', 'staging').continued) {
    failures.push('An API must accept a client from its own environment.');
  }

  if (!runEnvironmentMiddleware(middleware, '/health', 'GET', undefined).continued) {
    failures.push('The health endpoint must remain available without a client environment header.');
  }

  if (!runEnvironmentMiddleware(
    middleware,
    '/auth/oauth/discord/callback',
    'GET',
    undefined,
  ).continued) {
    failures.push('An OAuth provider callback must remain available without a client environment header.');
  }

  if (!runEnvironmentMiddleware(middleware, '/ratings', 'OPTIONS', undefined).continued) {
    failures.push('CORS preflight must remain available without a client environment header.');
  }

  return failures;
}

function runEnvironmentMiddleware(
  middleware: ReturnType<typeof createEnvironmentIsolationMiddleware>,
  path: string,
  method: string,
  environment: string | undefined,
) {
  const result = { continued: false, statusCode: 0 };

  middleware(
    {
      get: () => environment,
      method,
      path,
    },
    {
      status: (statusCode) => {
        result.statusCode = statusCode;
        return { json: () => undefined };
      },
    },
    () => {
      result.continued = true;
    },
  );

  return result;
}

function assertOptionalAuthControllersUseOptionalAuthGuard() {
  return optionalAuthControllers.flatMap((controller) =>
    hasGuard(controller, OptionalAuthGuard)
      ? []
      : [`${controller.name} must use OptionalAuthGuard.`],
  );
}

function assertProtectedControllersUseAuthGuard() {
  return protectedControllers.flatMap((controller) =>
    hasGuard(controller, AuthGuard) ? [] : [`${controller.name} must use AuthGuard.`],
  );
}

function assertAuthMeUsesAuthGuard() {
  return hasGuard(AuthController.prototype.me, AuthGuard)
    ? []
    : ['AuthController.me must use AuthGuard.'];
}

function assertPublicControllersStayPublic() {
  return publicControllers.flatMap((controller) =>
    hasAnyGuard(controller) ? [`${controller.name} should remain intentionally public.`] : [],
  );
}

function assertGlobalThrottlerGuard(appModule: Type<unknown>) {
  const providers = Reflect.getMetadata(MODULE_METADATA.PROVIDERS, appModule) ?? [];
  const hasThrottler = providers.some(
    (provider: unknown) =>
      isProviderObject(provider) &&
      provider.provide === APP_GUARD &&
      provider.useClass === ProxyAwareThrottlerGuard,
  );

  return hasThrottler ? [] : ['AppModule must install ProxyAwareThrottlerGuard as a global guard.'];
}

function assertProxyAwareThrottlerTracker() {
  const failures: string[] = [];

  if (resolveThrottlerTracker({ headers: { 'x-real-ip': ' 203.0.113.10 ' }, ip: '10.0.0.1' }) !== '203.0.113.10') {
    failures.push('Rate limiting must prefer the client IP provided by the Railway proxy.');
  }

  if (resolveThrottlerTracker({ ip: '127.0.0.1' }) !== '127.0.0.1') {
    failures.push('Rate limiting must fall back to the request IP outside Railway.');
  }

  return failures;
}

function hasGuard(target: object | Function, guard: Type<unknown>) {
  const guards = Reflect.getMetadata(GUARDS_METADATA, target) ?? [];

  return guards.includes(guard);
}

function hasAnyGuard(controller: ControllerClass) {
  const classGuards = Reflect.getMetadata(GUARDS_METADATA, controller) ?? [];

  return classGuards.length > 0;
}

function isProviderObject(value: unknown): value is { provide: unknown; useClass: unknown } {
  return typeof value === 'object' && value !== null && 'provide' in value && 'useClass' in value;
}

main();
