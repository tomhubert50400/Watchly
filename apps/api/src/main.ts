import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import 'reflect-metadata';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  const logger = new Logger('Bootstrap');
  const corsOrigin = config.get<string>('CORS_ORIGIN');
  const port = config.getOrThrow<number>('PORT');

  if (corsOrigin) {
    app.enableCors({ origin: corsOrigin });
  }

  await app.listen(port);
  logger.log(`API listening on port ${port}`);
}

void bootstrap();
