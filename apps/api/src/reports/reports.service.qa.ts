// Deterministic service-level QA without a database or external network.
import assert from 'node:assert/strict';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ReportsService } from './reports.service';

const REPORTER_ID = '11111111-1111-4111-8111-111111111111';
const SUBJECT_ID = '22222222-2222-4222-8222-222222222222';
const PROFILE_REPORT_ID = '33333333-3333-4333-8333-333333333333';
const MOVIE_REVIEW_ID = '44444444-4444-4444-8444-444444444444';
const EPISODE_REVIEW_ID = '55555555-5555-4555-8555-555555555555';

type StoredReport = {
  createdAt: Date;
  details: string | null;
  id: string;
  reason: string;
  reportedUserId: string;
  reporterId: string;
  status: string;
  targetId: string;
  targetSnapshot: unknown;
  targetType: string;
};

async function run() {
  const reports = new Map<string, StoredReport>();
  const prisma = {
    contentReport: {
      upsert: async ({ create, update, where }: {
        create: Omit<StoredReport, 'createdAt' | 'id'>;
        update: Partial<StoredReport>;
        where: { reporterId_targetType_targetId: {
          reporterId: string;
          targetId: string;
          targetType: string;
        } };
      }) => {
        const key = Object.values(where.reporterId_targetType_targetId).join(':');
        const existing = reports.get(key);
        const next = existing
          ? { ...existing, ...update }
          : {
              ...create,
              createdAt: new Date('2026-08-04T12:00:00.000Z'),
              id: PROFILE_REPORT_ID,
            };
        reports.set(key, next);
        return next;
      },
    },
    user: {
      findUnique: async ({ where }: { where: { id: string } }) => (
        [REPORTER_ID, SUBJECT_ID].includes(where.id)
          ? { displayName: where.id === SUBJECT_ID ? 'Reported member' : 'Reporter', id: where.id }
          : null
      ),
    },
    userEpisodeReview: {
      findUnique: async ({ where }: { where: { id: string } }) => (
        where.id === EPISODE_REVIEW_ID
          ? {
              body: 'Reported episode review',
              episodeNumber: 3,
              id: EPISODE_REVIEW_ID,
              seasonNumber: 2,
              seriesTmdbId: 1399,
              user: { displayName: 'Reported member' },
              userId: SUBJECT_ID,
            }
          : null
      ),
    },
    userMovieReview: {
      findUnique: async ({ where }: { where: { id: string } }) => (
        where.id === MOVIE_REVIEW_ID
          ? {
              body: 'Reported movie review',
              id: MOVIE_REVIEW_ID,
              tmdbId: 603,
              user: { displayName: 'Reported member' },
              userId: SUBJECT_ID,
            }
          : null
      ),
    },
    withConnectionRetry: async (operation: () => Promise<unknown>) => operation(),
  };
  const service = new ReportsService(
    { getOrCreateUser: async () => ({ id: REPORTER_ID }) } as never,
    prisma as never,
  );
  const identity = { firebaseUid: 'reporter' } as never;

  const profileReport = await service.submitReport(identity, {
    details: '  This profile is pretending to be someone else.  ',
    reason: 'impersonation',
    targetId: SUBJECT_ID,
    targetType: 'profile',
  });
  assert.deepEqual(profileReport, {
    createdAt: '2026-08-04T12:00:00.000Z',
    id: PROFILE_REPORT_ID,
    status: 'pending',
    targetType: 'profile',
  });
  const storedProfileReport = [...reports.values()][0];
  assert.equal(storedProfileReport.details, 'This profile is pretending to be someone else.');
  assert.deepEqual(storedProfileReport.targetSnapshot, {
    displayName: 'Reported member',
    userId: SUBJECT_ID,
  });

  await service.submitReport(identity, {
    details: ' ',
    reason: 'spam',
    targetId: SUBJECT_ID,
    targetType: 'profile',
  });
  assert.equal(reports.size, 1, 'Repeated reports must update the existing moderation item.');
  assert.equal([...reports.values()][0].details, null);
  assert.equal([...reports.values()][0].reason, 'SPAM');

  await service.submitReport(identity, {
    reason: 'harassment',
    targetId: MOVIE_REVIEW_ID,
    targetType: 'movieReview',
  });
  await service.submitReport(identity, {
    reason: 'hate',
    targetId: EPISODE_REVIEW_ID,
    targetType: 'episodeReview',
  });
  assert.equal(reports.size, 3, 'Movie and episode reviews must create distinct moderation items.');

  await assert.rejects(
    () => service.submitReport(identity, {
      reason: 'other',
      targetId: REPORTER_ID,
      targetType: 'profile',
    }),
    BadRequestException,
  );
  await assert.rejects(
    () => service.submitReport(identity, {
      reason: 'other',
      targetId: '66666666-6666-4666-8666-666666666666',
      targetType: 'movieReview',
    }),
    NotFoundException,
  );

  console.log('Reports service QA passed.');
}

void run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
