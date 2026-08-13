import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import 'reflect-metadata';
import { AppModule } from './app.module';
import { DevExceptionFilter } from './dev-exception.filter';
import { createEnvironmentIsolationMiddleware } from './environment-isolation';
import { createRequestObservabilityMiddleware } from './observability/request-observability.middleware';
import { StructuredLogger } from './observability/structured-logger';
import { initializeErrorTracking } from './observability/error-tracking';

async function bootstrap() {
  const environment = process.env.APP_ENV?.trim() || 'development';
  initializeErrorTracking({
    dsn: process.env.ERROR_TRACKING_DSN,
    environment,
    release: process.env.RAILWAY_GIT_COMMIT_SHA,
  });
  const structuredLogger = new StructuredLogger(environment);
  const app = await NestFactory.create(AppModule, {
    logger: structuredLogger,
  });
  const config = app.get(ConfigService);
  const logger = new Logger('Bootstrap');
  const corsOrigins = [
    config.get<string>('CORS_ORIGIN'),
    config.get<string>('CORS_ADDITIONAL_ORIGIN'),
  ].filter((origin): origin is string => Boolean(origin));
  const appEnvironment = config.getOrThrow<string>('APP_ENV');
  const isDevelopment = appEnvironment === 'development';
  const port = config.getOrThrow<number>('PORT');

  app.use(helmet());
  app.use(createRequestObservabilityMiddleware(structuredLogger));
  app.use(createEnvironmentIsolationMiddleware(appEnvironment));
  app.useGlobalPipes(
    new ValidationPipe({
      forbidNonWhitelisted: true,
      transform: false,
      whitelist: true,
    }),
  );
  app.useGlobalFilters(new DevExceptionFilter(isDevelopment, structuredLogger));

  if (corsOrigins.length > 0) {
    app.enableCors({ origin: corsOrigins });
  }

  await app.listen(port, '0.0.0.0');
  logger.log(`API listening on port ${port}`);
}

void bootstrap();
