import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import 'reflect-metadata';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log'],
  });
  const config = app.get(ConfigService);
  const logger = new Logger('Bootstrap');
  const corsOrigin = config.get<string>('CORS_ORIGIN');
  const port = config.getOrThrow<number>('PORT');

  app.use(helmet());
  app.useGlobalPipes(
    new ValidationPipe({
      forbidNonWhitelisted: true,
      transform: false,
      whitelist: true,
    }),
  );

  if (corsOrigin) {
    app.enableCors({ origin: corsOrigin });
  }

  await app.listen(port);
  logger.log(`API listening on port ${port}`);
}

void bootstrap();
