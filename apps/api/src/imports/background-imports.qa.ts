import assert from 'node:assert/strict';
import { BackgroundImportsService, estimateImportSeconds } from './background-imports.service';
import { DataImport, Prisma } from '../generated/prisma/client';
import { parseImportFile } from './import-file.parser';
import { ImportsService, readStoredPreview, StoredImportPreview } from './imports.service';

export async function verifyBackgroundImports() {
  assert.ok(estimateImportSeconds(10, 10, 500, 0) < 60);
  assert.ok(estimateImportSeconds(1001, 25, 2000, 0) > 60);
  assert.ok(estimateImportSeconds(1001, 25, 8000, 0) > estimateImportSeconds(1001, 25, 2000, 0));
  assert.ok(estimateImportSeconds(1001, 25, 2000, 3000) > estimateImportSeconds(1001, 25, 2000, 0));
  const id = 'b85d2207-6bd8-4ba1-8e9f-f727c86ad979';
  let record: DataImport | null = null;
  let userId = 'owner';
  const auth = { getOrCreateUser: async () => ({ id: userId }) } as unknown as ConstructorParameters<typeof BackgroundImportsService>[0];
  const identity = {} as Parameters<BackgroundImportsService['analyze']>[0];
  const dataImport = {
    create: async ({ data }: { data: Partial<DataImport> }) => {
      record = { id, userId: 'owner', source: 'LETTERBOXD', status: 'PREVIEWED', fileName: 'watched.csv',
        preview: {}, createdAt: new Date(), completedAt: null, background: false, estimatedSeconds: null,
        workerLease: null, workerLeaseUntil: null, workerAttempts: 0, workerNextAttemptAt: new Date(), dismissedAt: null,
        ...data };
      return structuredClone(record);
    },
    findFirst: async ({ where }: { where: Record<string, unknown> }) => record && matches(record, where) ? structuredClone(record) : null,
    findMany: async ({ where }: { where: Record<string, unknown> }) => record && matches(record, where) ? [structuredClone(record)] : [],
    update: async ({ data }: { data: Partial<DataImport> }) => {
      assert.ok(record);
      record = { ...record, ...structuredClone(data) };
      return structuredClone(record);
    },
    updateMany: async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
      if (!record || !matches(record, where)) return { count: 0 };
      for (const [key, value] of Object.entries(data)) {
        (record as unknown as Record<string, unknown>)[key] = value && typeof value === 'object' && 'increment' in value
          ? record.workerAttempts + Number(value.increment) : structuredClone(value);
      }
      return { count: 1 };
    },
    deleteMany: async ({ where }: { where: Record<string, unknown> }) => {
      if (!record || !matches(record, where)) return { count: 0 };
      record = null;
      return { count: 1 };
    },
  };
  const prisma = { dataImport } as unknown as ConstructorParameters<typeof BackgroundImportsService>[1];
  let matchingCalls = 0;
  let commitCalls = 0;
  let fail = false;
  const csv = Buffer.from('Name,Year,Letterboxd URI\n' + Array.from({ length: 2001 }, (_, index) =>
    `Movie ${index},2000,https://boxd.it/test${index}`).join('\n'));
  const parsed = parseImportFile('letterboxd', 'watched.csv', csv);
  const getRecord = () => { assert.ok(record); return record; };
  const imports = {
    preview: async () => {
      const preview: StoredImportPreview = { fileName: 'watched.csv', ignoredFileCount: 0, items: [],
        pendingItems: structuredClone(parsed.items), source: 'letterboxd', version: 3,
        summary: { favorites: 0, needsAttention: 0, ratings: 0, ready: 0, reviews: 0, total: 0, watched: 0, watching: 0, watchlisted: 0 } };
      await dataImport.create({ data: { preview: preview as unknown as Prisma.JsonValue } });
      return { importId: id };
    },
    prepareBatchForUser: async (owner: string) => {
      assert.equal(owner, 'owner');
      if (fail) throw new Error('Provider unavailable');
      matchingCalls += 1;
      const current = getRecord();
      const preview = readStoredPreview(current.preview);
      const batch = preview.pendingItems!.splice(0, 25);
      preview.items.push(...batch.map((item) => ({ ...item, status: 'ready' as const, issues: [], match: null, suggestion: null })));
      preview.summary.total = preview.items.length;
      current.preview = preview as unknown as Prisma.JsonValue;
      return { importId: id, preparation: { processed: preview.items.length, total: parsed.items.length } };
    },
    confirmBatchForUser: async (owner: string) => {
      assert.equal(owner, 'owner');
      if (fail) throw new Error('Database unavailable');
      commitCalls += 1;
      const current = getRecord();
      const preview = readStoredPreview(current.preview);
      preview.committedCount = Math.min(preview.items.length, (preview.committedCount ?? 0) + 25);
      if (preview.committedCount === preview.items.length) {
        current.status = 'COMPLETED';
        preview.items = [];
      }
      current.preview = preview as unknown as Prisma.JsonValue;
    },
  } as unknown as ImportsService;
  const service = new BackgroundImportsService(auth, prisma, imports);
  const upload = { buffer: csv, size: csv.length, originalname: 'watched.csv' };
  const analysis = await service.analyze(identity, 'letterboxd', upload);
  assert.ok(analysis.estimatedSeconds > 60);
  assert.equal(commitCalls, 0, 'analysis must not write library data');
  assert.equal(await service.processNextBatch(), false, 'analyzed files require explicit authorization');
  const sample = readStoredPreview(getRecord().preview).items;
  assert.ok(sample.some((item) => Number(item.sourceTitle.split(' ')[1]) > 1500), 'sample must span the export');
  await service.cancel(identity, id);
  assert.equal(record, null);
  await service.analyze(identity, 'letterboxd', upload);
  service.onModuleDestroy(); // Suppress automatic execution to inspect the persisted start boundary.
  await service.start(identity, id);
  assert.equal(getRecord().background, true);
  await assert.rejects(service.cancel(identity, id), /already started/);
  userId = 'other';
  await assert.rejects(service.start(identity, id), /not found/);
  assert.equal((await service.list(identity)).imports.length, 0);
  userId = 'owner';

  // A fresh worker needs only the stored user ID, not a Firebase token or a live app.
  const worker = new BackgroundImportsService({} as never, prisma, imports);
  getRecord().workerLease = id;
  getRecord().workerLeaseUntil = new Date(Date.now() + 60_000);
  assert.equal(await worker.processNextBatch(), false, 'another live lease must prevent duplicate work');
  getRecord().workerLeaseUntil = new Date(Date.now() - 1);
  assert.equal(await worker.processNextBatch(), true, 'an expired lease must recover after a crash');
  const before = readStoredPreview(getRecord().preview).items.length;
  fail = true;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    getRecord().workerNextAttemptAt = new Date(0);
    await worker.processNextBatch();
  }
  assert.equal(readStoredPreview(getRecord().preview).items.length, before, 'failures retain prepared work');
  assert.equal((await service.list(identity)).imports[0].status, 'failed');
  assert.equal(await worker.processNextBatch(), false, 'failed jobs stop retrying automatically');
  fail = false;
  await service.start(identity, id);
  // Even after the old preview TTL, an authorized job must be selected by the worker.
  getRecord().createdAt = new Date(0);
  await worker.runWorker();
  assert.equal(getRecord().status, 'COMPLETED');
  assert.ok(matchingCalls > 2 && commitCalls > 1);
  assert.equal((await service.list(identity)).imports[0].processed, 2001);
  await service.dismiss(identity, id);
  assert.equal((await service.list(identity)).imports.length, 0);
  console.log('Background import QA passed: consent, estimates, leases, retries, recovery, ownership and completion.');
}

function matches(record: DataImport, where: Record<string, unknown>): boolean {
  return Object.entries(where).every(([key, condition]) => {
    if (key === 'OR') return (condition as Record<string, unknown>[]).some((branch) => matches(record, branch));
    const value = (record as unknown as Record<string, unknown>)[key];
    if (condition && typeof condition === 'object' && !(condition instanceof Date)) {
      if ('lt' in condition) return value !== null && Number(value) < Number(condition.lt);
      if ('lte' in condition) return value !== null && Number(value) <= Number(condition.lte);
    }
    return value === condition;
  });
}
