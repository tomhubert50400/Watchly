import assert from 'node:assert/strict';
import { ConflictException } from '@nestjs/common';
import { AdminAuditAction, ReportReason, ReportStatus, ReportTargetType } from '../generated/prisma/enums';
import { AdminService } from './admin.service';

const REPORT_ID = '11111111-1111-4111-8111-111111111111';
const REPORTER_ID = '22222222-2222-4222-8222-222222222222';
const SUBJECT_ID = '33333333-3333-4333-8333-333333333333';

async function run() {
  const auditLogs: Array<Record<string, unknown>> = [];
  const report = {
    createdAt: new Date('2026-08-13T09:00:00.000Z'),
    details: 'Repeated unsolicited messages.',
    id: REPORT_ID,
    reason: ReportReason.SPAM,
    reportedUser: { displayName: 'Reported member', handle: 'reported', id: SUBJECT_ID },
    reporter: { displayName: 'Reporter', handle: 'reporter', id: REPORTER_ID },
    resolvedAt: null as Date | null,
    status: ReportStatus.PENDING as ReportStatus,
    targetId: SUBJECT_ID,
    targetSnapshot: { displayName: 'Reported member' },
    targetType: ReportTargetType.PROFILE,
    updatedAt: new Date('2026-08-13T09:00:00.000Z'),
  };
  const adminAuditLog = {
    create: async ({ data }: { data: Record<string, unknown> }) => {
      const entry = {
        ...data,
        createdAt: new Date('2026-08-13T09:05:00.000Z'),
        id: `audit-${auditLogs.length + 1}`,
      };
      auditLogs.push(entry);
      return entry;
    },
    findMany: async () => auditLogs.filter((entry) => entry.reportId === REPORT_ID),
  };
  const contentReport = {
    count: async () => 1,
    findMany: async () => [report],
    findUnique: async () => report,
    update: async ({ data }: { data: { resolvedAt: Date | null; status: ReportStatus } }) => {
      report.resolvedAt = data.resolvedAt;
      report.status = data.status;
      report.updatedAt = new Date('2026-08-13T09:06:00.000Z');
      return report;
    },
  };
  const prisma = {
    $transaction: async (operation: (transaction: unknown) => Promise<unknown>) => operation({
      adminAuditLog,
      contentReport,
    }),
    adminAuditLog,
    contentReport,
    withConnectionRetry: async (operation: () => Promise<unknown>) => operation(),
  };
  const service = new AdminService(prisma as never);
  const identity = {
    email: 'moderator@watchly.test',
    firebaseUid: 'firebase-admin-1',
    secondFactor: 'totp',
  };

  const list = await service.listReports(identity, { page: 1, pageSize: 25 });
  assert.equal(list.total, 1);
  assert.equal(list.items[0]?.status, 'new');
  assert.equal(auditLogs[0]?.action, AdminAuditAction.REPORT_LIST_VIEWED);

  const detail = await service.getReport(identity, REPORT_ID);
  assert.equal(detail.targetType, 'profile');
  assert.equal(auditLogs[1]?.action, AdminAuditAction.REPORT_VIEWED);

  const updated = await service.updateReportStatus(identity, REPORT_ID, {
    note: '  Reviewed the captured profile and started investigation.  ',
    status: 'inProgress',
  });
  assert.equal(updated.status, 'inProgress');
  assert.equal(auditLogs[2]?.action, AdminAuditAction.REPORT_STATUS_CHANGED);
  assert.deepEqual(auditLogs[2]?.metadata, {
    fromStatus: 'new',
    note: 'Reviewed the captured profile and started investigation.',
    toStatus: 'inProgress',
  });

  await assert.rejects(
    () => service.updateReportStatus(identity, REPORT_ID, {
      note: 'Already assigned.',
      status: 'inProgress',
    }),
    ConflictException,
  );

  console.log('Admin service QA passed.');
}

void run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
