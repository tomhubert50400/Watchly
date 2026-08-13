import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { PrismaClient } from '../generated/prisma/client';
import { isPrismaConnectionError } from './prisma-retry';

@Injectable()
export class PrismaService implements OnModuleDestroy {
  private static client: PrismaClient | null = null;
  private static connectionGeneration = 0;
  private static pool: pg.Pool | null = null;
  private static resetPromise: Promise<void> | null = null;
  private readonly connectionString: string;

  constructor(@Inject(ConfigService) config: ConfigService) {
    this.connectionString = config.getOrThrow<string>('DATABASE_URL');

    if (!PrismaService.client || !PrismaService.pool) {
      const connection = this.createConnection();

      PrismaService.client = connection.client;
      PrismaService.pool = connection.pool;
    }
  }

  get auditLog() {
    return this.client.auditLog;
  }

  get catalogueSpotlight() {
    return this.client.catalogueSpotlight;
  }

  get contentReport() {
    return this.client.contentReport;
  }

  get dataImport() {
    return this.client.dataImport;
  }

  get episodeReviewLike() {
    return this.client.episodeReviewLike;
  }

  get authIdentity() {
    return this.client.authIdentity;
  }

  get personalWatchlist() {
    return this.client.personalWatchlist;
  }

  get personalWatchlistItem() {
    return this.client.personalWatchlistItem;
  }

  get privacySettings() {
    return this.client.privacySettings;
  }

  get releaseAlertSubscription() {
    return this.client.releaseAlertSubscription;
  }

  get releaseEvent() {
    return this.client.releaseEvent;
  }

  get releaseEventSyncRun() {
    return this.client.releaseEventSyncRun;
  }

  get notification() {
    return this.client.notification;
  }

  get movieReviewLike() {
    return this.client.movieReviewLike;
  }

  get sharedVotingCandidate() {
    return this.client.sharedVotingCandidate;
  }

  get sharedVotingSession() {
    return this.client.sharedVotingSession;
  }

  get sharedVotingVote() {
    return this.client.sharedVotingVote;
  }

  get sharedWatchlist() {
    return this.client.sharedWatchlist;
  }

  get sharedWatchlistItem() {
    return this.client.sharedWatchlistItem;
  }

  get sharedWatchlistMember() {
    return this.client.sharedWatchlistMember;
  }

  get user() {
    return this.client.user;
  }

  get userBlock() {
    return this.client.userBlock;
  }

  get userContentState() {
    return this.client.userContentState;
  }

  get userEpisodeProgress() {
    return this.client.userEpisodeProgress;
  }

  get userEpisodeRating() {
    return this.client.userEpisodeRating;
  }

  get userEpisodeReview() {
    return this.client.userEpisodeReview;
  }

  get userFollow() {
    return this.client.userFollow;
  }

  get userMovieRating() {
    return this.client.userMovieRating;
  }

  get userMovieReview() {
    return this.client.userMovieReview;
  }

  get viewingEvent() {
    return this.client.viewingEvent;
  }

  $queryRaw: PrismaClient['$queryRaw'] = ((...args: Parameters<PrismaClient['$queryRaw']>) =>
    (this.client.$queryRaw as (...queryArgs: Parameters<PrismaClient['$queryRaw']>) => ReturnType<PrismaClient['$queryRaw']>)(
      ...args,
    )) as PrismaClient['$queryRaw'];

  $transaction: PrismaClient['$transaction'] = ((...args: Parameters<PrismaClient['$transaction']>) =>
    (
      this.client.$transaction as (
        ...transactionArgs: Parameters<PrismaClient['$transaction']>
      ) => ReturnType<PrismaClient['$transaction']>
    )(...args)) as PrismaClient['$transaction'];

  async $disconnect() {
    const client = PrismaService.client;
    const pool = PrismaService.pool;

    PrismaService.client = null;
    PrismaService.pool = null;

    await client?.$disconnect().catch(() => undefined);
    await pool?.end().catch(() => undefined);
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  async resetConnection(failedGeneration = this.connectionGeneration) {
    if (PrismaService.resetPromise) {
      await PrismaService.resetPromise;
      return;
    }

    if (failedGeneration !== this.connectionGeneration) {
      return;
    }

    PrismaService.resetPromise ??= this.replaceConnection().finally(() => {
      PrismaService.resetPromise = null;
    });

    await PrismaService.resetPromise;
  }

  async withConnectionRetry<T>(operation: () => Promise<T>) {
    let lastError: unknown;

    for (let attempt = 0; attempt < 8; attempt += 1) {
      const failedGeneration = this.connectionGeneration;

      try {
        return await operation();
      } catch (error) {
        if (!isPrismaConnectionError(error)) {
          throw error;
        }

        lastError = error;

        await this.resetConnection(failedGeneration);
        await delay((attempt + 1) * 300);
      }
    }

    throw lastError;
  }

  private createConnection() {
    const pool = new pg.Pool({
      connectionString: this.connectionString,
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 30000,
      max: 10,
      maxLifetimeSeconds: 300,
    });

    return {
      client: new PrismaClient({
        adapter: new PrismaPg(pool),
      }),
      pool,
    };
  }

  private async replaceConnection() {
    const previousClient = this.client;
    const previousPool = this.pool;
    const connection = this.createConnection();

    PrismaService.client = connection.client;
    PrismaService.pool = connection.pool;
    PrismaService.connectionGeneration += 1;

    await previousClient.$disconnect().catch(() => undefined);
    await previousPool.end().catch(() => undefined);
  }

  private get client() {
    if (!PrismaService.client) {
      throw new Error('Prisma client is not initialized.');
    }

    return PrismaService.client;
  }

  private get connectionGeneration() {
    return PrismaService.connectionGeneration;
  }

  private get pool() {
    if (!PrismaService.pool) {
      throw new Error('Prisma pool is not initialized.');
    }

    return PrismaService.pool;
  }
}

function delay(durationMs: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, durationMs);
  });
}
