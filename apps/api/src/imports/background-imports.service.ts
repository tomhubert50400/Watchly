import { BadRequestException, ConflictException, Inject, Injectable, Logger, NotFoundException, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { AuthService } from '../auth/auth.service';
import { AuthenticatedIdentity } from '../auth/auth.types';
import { assertUuid } from '../blocks/blocks.service';
import { PrismaService } from '../database/prisma.service';
import { DataImport, Prisma } from '../generated/prisma/client';
import { ImportSourceValue } from './import-file.parser';
import { ImportsService, ImportUpload, readStoredPreview, StoredImportPreview } from './imports.service';

const MAX_ATTEMPTS = 5;
const LEASE_MS = 10 * 60_000;

@Injectable()
export class BackgroundImportsService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(BackgroundImportsService.name);
  private timer: ReturnType<typeof setInterval> | null = null;
  private running: Promise<void> | null = null;
  private stopped = false;

  constructor(
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ImportsService) private readonly imports: ImportsService,
  ) {}

  onApplicationBootstrap() {
    this.timer = setInterval(() => void this.runWorker(), 5_000);
    this.timer.unref();
    void this.runWorker();
  }

  onModuleDestroy() {
    this.stopped = true;
    if (this.timer) clearInterval(this.timer);
  }

  async analyze(identity: AuthenticatedIdentity, source: ImportSourceValue, file: ImportUpload) {
    const uploaded = await this.imports.preview(identity, source, file, true);
    const record = await this.owned(identity, uploaded.importId);
    const preview = readStoredPreview(record.preview);
    const pending = preview.pendingItems!;
    // Spread the sample across the export so its first rows do not determine the estimate.
    const indexes = new Set(Array.from({ length: Math.min(25, pending.length) }, (_, index) =>
      Math.floor(index * pending.length / Math.min(25, pending.length))));
    const sampled = pending.filter((_, index) => indexes.has(index));
    preview.pendingItems = [...sampled, ...pending.filter((_, index) => !indexes.has(index))];
    await this.prisma.dataImport.update({
      where: { id: record.id }, data: { preview: preview as unknown as Prisma.InputJsonValue },
    });
    const startedAt = Date.now();
    const prepared = await this.imports.prepareBatchForUser(record.userId, record.id);
    const estimatedSeconds = estimateImportSeconds(pending.length, sampled.length, Date.now() - startedAt,
      pending.reduce((total, item) => total + (item.episodes?.length ?? 0), 0));
    // Include queued work: this worker processes one catalogue batch at a time.
    const queued = await this.prisma.dataImport.findMany({
      where: { background: true, status: 'PREVIEWED', workerAttempts: { lt: MAX_ATTEMPTS } },
      select: { estimatedSeconds: true, preview: true },
    });
    const queueSeconds = queued.reduce((total, job) => {
      const state = readStoredPreview(job.preview);
      const count = state.items.length + (state.pendingItems?.length ?? 0);
      const remainingFraction = count ? 1 - (state.committedCount ?? 0) / count : 0;
      return total + Math.ceil((job.estimatedSeconds ?? 60) * remainingFraction);
    }, 0);
    await this.prisma.dataImport.update({ where: { id: record.id }, data: { estimatedSeconds } });
    return { ...prepared, estimatedSeconds: estimatedSeconds + queueSeconds };
  }

  async cancel(identity: AuthenticatedIdentity, importId: string) {
    const record = await this.owned(identity, importId);
    const deleted = await this.prisma.dataImport.deleteMany({
      where: { id: record.id, userId: record.userId, background: false, status: 'PREVIEWED' },
    });
    if (!deleted.count) throw new ConflictException('This import has already started.');
    return { cancelled: true };
  }

  async start(identity: AuthenticatedIdentity, importId: string) {
    const record = await this.owned(identity, importId);
    if (record.status === 'COMPLETED') return toBackgroundImport(record);
    if (!record.background && record.createdAt.getTime() < Date.now() - 24 * 60 * 60_000) {
      throw new BadRequestException('This analysis expired. Choose the file again.');
    }
    const updated = await this.prisma.dataImport.update({
      where: { id: record.id },
      data: { background: true, workerAttempts: 0, workerNextAttemptAt: new Date(), dismissedAt: null },
    });
    // The persisted flag is the authorization. Workers never pick up a mere analysis.
    void this.runWorker();
    return toBackgroundImport(updated);
  }

  async list(identity: AuthenticatedIdentity) {
    const user = await this.auth.getOrCreateUser(identity);
    const records = await this.prisma.dataImport.findMany({
      where: { userId: user.id, background: true, dismissedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    return { imports: records.map(toBackgroundImport) };
  }

  async dismiss(identity: AuthenticatedIdentity, importId: string) {
    const record = await this.owned(identity, importId);
    if (record.status !== 'COMPLETED') throw new BadRequestException('This import is still processing.');
    await this.prisma.dataImport.update({ where: { id: record.id }, data: { dismissedAt: new Date() } });
    return { dismissed: true };
  }

  async review(identity: AuthenticatedIdentity, importId: string) {
    const record = await this.owned(identity, importId);
    if (!record.background || record.status !== 'COMPLETED') throw new BadRequestException('Wait for this import to finish.');
    const preview = readStoredPreview(record.preview);
    if (!preview.items.length) throw new BadRequestException('No titles need review.');
    const { result: _result, committedCount: _committedCount, ...remaining } = preview;
    const review: StoredImportPreview = { ...remaining, summary: {
      favorites: 0, needsAttention: remaining.items.length, ratings: 0, ready: 0, reviews: 0,
      total: remaining.items.length, watched: 0, watching: 0, watchlisted: 0,
    } };
    const created = await this.prisma.dataImport.create({ data: {
      userId: record.userId, source: record.source, fileName: record.fileName,
      preview: review as unknown as Prisma.InputJsonValue,
    } });
    return this.imports.getPreview(identity, created.id);
  }

  runWorker(): Promise<void> {
    if (this.running) return this.running;
    this.running = (async () => {
      try {
        while (!this.stopped && await this.processNextBatch()) { /* Drain available batches. */ }
      } catch {
        this.logger.warn('Import worker unavailable; persisted jobs will be retried.');
      } finally {
        this.running = null;
      }
    })();
    return this.running;
  }

  async processNextBatch() {
    const available: Prisma.DataImportWhereInput = {
      background: true, status: 'PREVIEWED', workerAttempts: { lt: MAX_ATTEMPTS },
      workerNextAttemptAt: { lte: new Date() },
      OR: [{ workerLeaseUntil: null }, { workerLeaseUntil: { lt: new Date() } }],
    };
    const record = await this.prisma.dataImport.findFirst({ where: available, orderBy: { workerNextAttemptAt: 'asc' } });
    if (!record) return false;
    const lease = randomUUID();
    const claimed = await this.prisma.dataImport.updateMany({
      where: { ...available, id: record.id },
      data: { workerLease: lease, workerLeaseUntil: new Date(Date.now() + LEASE_MS) },
    });
    if (!claimed.count) return false;
    try {
      const preview = readStoredPreview(record.preview);
      if (preview.pendingItems?.length) await this.imports.prepareBatchForUser(record.userId, record.id);
      else await this.imports.confirmBatchForUser(record.userId, record.id);
      await this.prisma.dataImport.updateMany({
        where: { id: record.id, workerLease: lease },
        data: { workerLease: null, workerLeaseUntil: null, workerAttempts: 0, workerNextAttemptAt: new Date() },
      });
    } catch {
      await this.prisma.dataImport.updateMany({
        where: { id: record.id, workerLease: lease },
        data: { workerLease: null, workerLeaseUntil: null, workerAttempts: { increment: 1 },
          workerNextAttemptAt: new Date(Date.now() + 30_000 * 2 ** record.workerAttempts) },
      });
      this.logger.warn(`Import ${record.id} batch paused; progress is retained.`);
    }
    return true;
  }

  private async owned(identity: AuthenticatedIdentity, importId: string) {
    assertUuid(importId);
    const user = await this.auth.getOrCreateUser(identity);
    const record = await this.prisma.dataImport.findFirst({ where: { id: importId, userId: user.id } });
    if (!record) throw new NotFoundException('Import not found.');
    return record;
  }
}

export function estimateImportSeconds(total: number, sampled: number, elapsedMs: number, episodes: number) {
  // Measured matching throughput plus a conservative allowance for writes and variability.
  const matchingSeconds = Math.max(0, total - sampled) * Math.max(20, elapsedMs) / Math.max(1, sampled) / 1000;
  return Math.ceil(matchingSeconds * 1.5 + total * 0.04 + episodes * 0.005 + 2);
}

function toBackgroundImport(record: DataImport) {
  const preview = readStoredPreview(record.preview);
  const completed = record.status === 'COMPLETED';
  const total = completed ? preview.summary.total : preview.items.length + (preview.pendingItems?.length ?? 0);
  return {
    importId: record.id, fileName: record.fileName,
    status: completed ? 'completed' : record.workerAttempts >= MAX_ATTEMPTS ? 'failed' : 'processing',
    phase: preview.pendingItems?.length ? 'matching' : 'importing',
    processed: completed ? total : preview.pendingItems?.length ? preview.items.length : preview.committedCount ?? 0,
    total, needsAttention: preview.summary.needsAttention, result: preview.result ?? null,
  };
}
