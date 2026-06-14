import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { PrismaClient } from '../generated/prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor(@Inject(ConfigService) config: ConfigService) {
    const pool = new pg.Pool({
      connectionString: config.getOrThrow<string>('DATABASE_URL'),
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 500,
      max: 10,
      maxLifetimeSeconds: 10,
    });

    super({
      adapter: new PrismaPg(pool),
    });
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
