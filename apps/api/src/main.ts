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

async function bootstrap() {
  const structuredLogger = new StructuredLogger(process.env.APP_ENV?.trim() || 'development');
  const app = await NestFactory.create(AppModule, {
    logger: structuredLogger,
  });
  const config = app.get(ConfigService);
  const logger = new Logger('Bootstrap');
  const corsOrigin = config.get<string>('CORS_ORIGIN');
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

  if (corsOrigin) {
    app.enableCors({ origin: corsOrigin });
  }

  await app.listen(port, '0.0.0.0');
  logger.log(`API listening on port ${port}`);
}

void bootstrap();
