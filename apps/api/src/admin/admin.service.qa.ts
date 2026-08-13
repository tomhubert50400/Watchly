import assert from 'node:assert/strict';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { AdminAuditAction, ReportReason, ReportStatus, ReportTargetType } from '../generated/prisma/enums';
import { AdminService } from './admin.service';

const PROFILE_REPORT_ID = '11111111-1111-4111-8111-111111111111';
const MOVIE_REPORT_ID = '44444444-4444-4444-8444-444444444444';
const EPISODE_REPORT_ID = '55555555-5555-4555-8555-555555555555';
const REPORTER_ID = '22222222-2222-4222-8222-222222222222';
const SUBJECT_ID = '33333333-3333-4333-8333-333333333333';
const MOVIE_REVIEW_ID = '66666666-6666-4666-8666-666666666666';
const EPISODE_REVIEW_ID = '77777777-7777-4777-8777-777777777777';

async function run() {
  const auditLogs: Array<Record<string, unknown>> = [];
  const reports = new Map([
    [PROFILE_REPORT_ID, createReport(PROFILE_REPORT_ID, ReportTargetType.PROFILE, SUBJECT_ID)],
    [MOVIE_REPORT_ID, createReport(MOVIE_REPORT_ID, ReportTargetType.MOVIE_REVIEW, MOVIE_REVIEW_ID)],
    [EPISODE_REPORT_ID, createReport(EPISODE_REPORT_ID, ReportTargetType.EPISODE_REVIEW, EPISODE_REVIEW_ID)],
  ]);
  const content = {
    [MOVIE_REVIEW_ID]: { moderationHiddenAt: null as Date | null, userId: SUBJECT_ID },
    [EPISODE_REVIEW_ID]: { moderationHiddenAt: null as Date | null, userId: SUBJECT_ID },
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
    findMany: async () => auditLogs.filter((entry) => entry.reportId === PROFILE_REPORT_ID),
  };
  const contentReport = {
    count: async () => reports.size,
    findMany: async () => [...reports.values()],
    findUnique: async ({ where }: { where: { id: string } }) => reports.get(where.id) ?? null,
    update: async ({ data, where }: {
      data: { resolvedAt: Date | null; status: ReportStatus };
      where: { id: string };
    }) => {
      const report = reports.get(where.id);
      assert(report);
      report.resolvedAt = data.resolvedAt;
      report.status = data.status;
      report.updatedAt = new Date('2026-08-13T09:06:00.000Z');
      return report;
    },
  };
  const user = {
    update: async ({ data }: { data: { suspendedAt: Date | null } }) => {
      for (const report of reports.values()) report.reportedUser.suspendedAt = data.suspendedAt;
      return reports.get(PROFILE_REPORT_ID)?.reportedUser;
    },
  };
  const userMovieReview = createReviewDelegate(content[MOVIE_REVIEW_ID]);
  const userEpisodeReview = createReviewDelegate(content[EPISODE_REVIEW_ID]);
  const prisma = {
    $transaction: async (operation: (transaction: unknown) => Promise<unknown>) => operation({
      adminAuditLog,
      contentReport,
      user,
      userEpisodeReview,
      userMovieReview,
    }),
    adminAuditLog,
    contentReport,
    userEpisodeReview,
    userMovieReview,
    withConnectionRetry: async (operation: () => Promise<unknown>) => operation(),
  };
  const service = new AdminService(prisma as never);
  const identity = {
    email: 'moderator@watchly.test',
    firebaseUid: 'firebase-admin-1',
    secondFactor: 'totp',
  };

  const list = await service.listReports(identity, { page: 1, pageSize: 25 });
  assert.equal(list.total, 3);
  assert.equal(list.items[0]?.status, 'new');
  assert.equal(auditLogs[0]?.action, AdminAuditAction.REPORT_LIST_VIEWED);

  const detail = await service.getReport(identity, PROFILE_REPORT_ID);
  assert.equal(detail.moderationState, 'active');
  assert.equal(auditLogs[1]?.action, AdminAuditAction.REPORT_VIEWED);

  const updated = await service.updateReportStatus(identity, PROFILE_REPORT_ID, {
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
    () => service.updateReportStatus(identity, PROFILE_REPORT_ID, { note: '   ', status: 'resolved' }),
    BadRequestException,
  );

  const suspended = await service.applyModerationAction(identity, PROFILE_REPORT_ID, {
    action: 'suspendUser',
    note: 'Confirmed repeated harassment.',
  });
  assert.equal(suspended.status, 'resolved');
  assert(reports.get(PROFILE_REPORT_ID)?.reportedUser.suspendedAt instanceof Date);
  assert.equal(auditLogs.at(-1)?.action, AdminAuditAction.USER_SUSPENDED);

  await assert.rejects(
    () => service.applyModerationAction(identity, PROFILE_REPORT_ID, {
      action: 'suspendUser',
      note: 'Duplicate suspension attempt.',
    }),
    ConflictException,
  );

  await service.applyModerationAction(identity, PROFILE_REPORT_ID, {
    action: 'reactivateUser',
    note: 'Account restored after review.',
  });
  assert.equal(reports.get(PROFILE_REPORT_ID)?.reportedUser.suspendedAt, null);
  assert.equal(auditLogs.at(-1)?.action, AdminAuditAction.USER_REACTIVATED);

  await assert.rejects(
    () => service.applyModerationAction(identity, PROFILE_REPORT_ID, {
      action: 'hideContent',
      note: 'Invalid action target.',
    }),
    BadRequestException,
  );

  await assertContentActions(service, identity, MOVIE_REPORT_ID, content[MOVIE_REVIEW_ID]);
  await assertContentActions(service, identity, EPISODE_REPORT_ID, content[EPISODE_REVIEW_ID]);

  console.log('Admin service QA passed.');
}

function createReport(id: string, targetType: ReportTargetType, targetId: string) {
  return {
    createdAt: new Date('2026-08-13T09:00:00.000Z'),
    details: 'Repeated unsolicited messages.',
    id,
    reason: ReportReason.SPAM,
    reportedUser: {
      displayName: 'Reported member',
      handle: 'reported',
      id: SUBJECT_ID,
      suspendedAt: null as Date | null,
    },
    reporter: { displayName: 'Reporter', handle: 'reporter', id: REPORTER_ID },
    resolvedAt: null as Date | null,
    status: ReportStatus.PENDING as ReportStatus,
    targetId,
    targetSnapshot: { displayName: 'Reported member' },
    targetType,
    updatedAt: new Date('2026-08-13T09:00:00.000Z'),
  };
}

function createReviewDelegate(review: { moderationHiddenAt: Date | null; userId: string }) {
  return {
    findUnique: async () => review,
    update: async ({ data }: { data: { moderationHiddenAt: Date | null } }) => {
      review.moderationHiddenAt = data.moderationHiddenAt;
      return review;
    },
  };
}

async function assertContentActions(
  service: AdminService,
  identity: { email: string; firebaseUid: string; secondFactor: string },
  reportId: string,
  content: { moderationHiddenAt: Date | null },
) {
  await service.applyModerationAction(identity, reportId, {
    action: 'hideContent',
    note: 'Review violates community rules.',
  });
  assert(content.moderationHiddenAt instanceof Date);

  await assert.rejects(
    () => service.applyModerationAction(identity, reportId, {
      action: 'hideContent',
      note: 'Duplicate hide attempt.',
    }),
    ConflictException,
  );

  await service.applyModerationAction(identity, reportId, {
    action: 'restoreContent',
    note: 'Review restored after second review.',
  });
  assert.equal(content.moderationHiddenAt, null);
}

void run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
