import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuthenticatedAdmin } from '../auth/auth.types';
import { PrismaService } from '../database/prisma.service';
import { Prisma } from '../generated/prisma/client';
import {
  AdminAuditAction,
  ReportReason,
  ReportStatus,
  ReportTargetType,
} from '../generated/prisma/enums';
import {
  isAccountSuspended,
  activeAccountWhere,
  suspendedAccountWhere,
} from '../moderation/account-suspension';
import {
  AdminReportReason,
  AdminReportStatus,
  AdminReportTargetType,
  AdminSuspensionDuration,
  ApplyModerationActionDto,
  ListReportsQuery,
  ListUsersQuery,
  ReactivateUserDto,
  SuspendUserDto,
  UpdateReportStatusDto,
} from './admin.dto';

const reportSelect = {
  createdAt: true,
  details: true,
  id: true,
  reason: true,
  reportedUser: {
    select: {
      displayName: true,
      handle: true,
      id: true,
      suspendedAt: true,
      suspendedUntil: true,
    },
  },
  reporter: {
    select: {
      displayName: true,
      handle: true,
      id: true,
    },
  },
  resolvedAt: true,
  status: true,
  targetId: true,
  targetSnapshot: true,
  targetType: true,
  updatedAt: true,
} satisfies Prisma.ContentReportSelect;

type SelectedReport = Prisma.ContentReportGetPayload<{ select: typeof reportSelect }>;

const userSummarySelect = {
  _count: {
    select: {
      reportsReceived: true,
      suspensions: true,
    },
  },
  authIdentities: {
    orderBy: { createdAt: 'asc' as const },
    select: {
      email: true,
      provider: true,
      providerUserId: true,
    },
  },
  createdAt: true,
  displayName: true,
  handle: true,
  id: true,
  suspendedAt: true,
  suspendedUntil: true,
} satisfies Prisma.UserSelect;

type SelectedUserSummary = Prisma.UserGetPayload<{ select: typeof userSummarySelect }>;

@Injectable()
export class AdminService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async listReports(identity: AuthenticatedAdmin, query: ListReportsQuery) {
    const where = buildReportWhere(query);
    const skip = (query.page - 1) * query.pageSize;
    const [reports, total] = await this.prisma.withConnectionRetry(() =>
      Promise.all([
        this.prisma.contentReport.findMany({
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          select: reportSelect,
          skip,
          take: query.pageSize,
          where,
        }),
        this.prisma.contentReport.count({ where }),
      ]),
    );

    await this.writeAudit(identity, AdminAuditAction.REPORT_LIST_VIEWED, {
      metadata: {
        filters: {
          queryUsed: Boolean(query.query),
          ...(query.reason ? { reason: query.reason } : {}),
          ...(query.status ? { status: query.status } : {}),
          ...(query.targetType ? { targetType: query.targetType } : {}),
        },
        page: query.page,
        pageSize: query.pageSize,
        resultCount: reports.length,
      },
    });

    return {
      items: reports.map(toReportResponse),
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.ceil(total / query.pageSize),
    };
  }

  async getReport(identity: AuthenticatedAdmin, reportId: string) {
    const report = await this.prisma.withConnectionRetry(() =>
      this.prisma.contentReport.findUnique({
        select: reportSelect,
        where: { id: reportId },
      }),
    );

    if (!report) {
      throw new NotFoundException('Report not found.');
    }

    const auditTrail = await this.prisma.withConnectionRetry(() =>
      this.prisma.adminAuditLog.findMany({
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        select: {
          action: true,
          actorEmail: true,
          createdAt: true,
          id: true,
          metadata: true,
        },
        where: { reportId },
      }),
    );

    await this.writeAudit(identity, AdminAuditAction.REPORT_VIEWED, {
      reportId,
      reportedUserId: report.reportedUser.id,
    });

    return {
      ...toReportResponse(report),
      auditTrail: auditTrail.map((entry) => ({
        action: toAuditAction(entry.action),
        actorEmail: entry.actorEmail,
        createdAt: entry.createdAt.toISOString(),
        id: entry.id,
        metadata: entry.metadata,
      })),
      moderationEndsAt: report.targetType === ReportTargetType.PROFILE &&
        isAccountSuspended(report.reportedUser)
        ? report.reportedUser.suspendedUntil?.toISOString() ?? null
        : null,
      moderationState: await this.getModerationState(report),
    };
  }

  async updateReportStatus(
    identity: AuthenticatedAdmin,
    reportId: string,
    input: UpdateReportStatusDto,
  ) {
    const nextStatus = toPrismaStatus(input.status);
    const note = normalizeAdminNote(input.note);

    const report = await this.prisma.withConnectionRetry(() =>
      this.prisma.$transaction(async (transaction) => {
        const existing = await transaction.contentReport.findUnique({
          select: reportSelect,
          where: { id: reportId },
        });

        if (!existing) {
          throw new NotFoundException('Report not found.');
        }

        if (existing.status === nextStatus) {
          throw new ConflictException('Report already has this status.');
        }

        const previousStatus = existing.status;

        const updated = await transaction.contentReport.update({
          data: {
            resolvedAt: isClosedStatus(nextStatus) ? new Date() : null,
            status: nextStatus,
          },
          select: reportSelect,
          where: { id: reportId },
        });

        await transaction.adminAuditLog.create({
          data: {
            action: AdminAuditAction.REPORT_STATUS_CHANGED,
            actorEmail: identity.email,
            actorFirebaseUid: identity.firebaseUid,
            metadata: {
              fromStatus: toApiStatus(previousStatus),
              note,
              toStatus: input.status,
            },
            reportId,
            reportedUserId: existing.reportedUser.id,
          },
        });

        return updated;
      }),
    );

    return toReportResponse(report);
  }

  async applyModerationAction(
    identity: AuthenticatedAdmin,
    reportId: string,
    input: ApplyModerationActionDto,
  ) {
    const note = normalizeAdminNote(input.note);

    const report = await this.prisma.withConnectionRetry(() =>
      this.prisma.$transaction(async (transaction) => {
        const existing = await transaction.contentReport.findUnique({
          select: reportSelect,
          where: { id: reportId },
        });

        if (!existing) {
          throw new NotFoundException('Report not found.');
        }

        const action = await applyEnforcement(
          transaction,
          existing,
          input,
          note,
          identity,
        );
        const previousStatus = existing.status;
        const updated = await transaction.contentReport.update({
          data: {
            resolvedAt: new Date(),
            status: ReportStatus.RESOLVED,
          },
          select: reportSelect,
          where: { id: reportId },
        });

        await transaction.adminAuditLog.create({
          data: {
            action,
            actorEmail: identity.email,
            actorFirebaseUid: identity.firebaseUid,
            metadata: {
              action: input.action,
              ...(input.duration ? { duration: input.duration } : {}),
              fromStatus: toApiStatus(previousStatus),
              note,
              toStatus: 'resolved',
            },
            reportId,
            reportedUserId: existing.reportedUser.id,
          },
        });

        return updated;
      }),
    );

    return toReportResponse(report);
  }

  async listUsers(identity: AuthenticatedAdmin, query: ListUsersQuery) {
    const now = new Date();
    const where = buildUserWhere(query, now);
    const skip = (query.page - 1) * query.pageSize;
    const [users, total] = await this.prisma.withConnectionRetry(() =>
      Promise.all([
        this.prisma.user.findMany({
          orderBy: [{ suspendedAt: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
          select: userSummarySelect,
          skip,
          take: query.pageSize,
          where,
        }),
        this.prisma.user.count({ where }),
      ]),
    );

    await this.writeAudit(identity, AdminAuditAction.USER_LIST_VIEWED, {
      metadata: {
        filters: {
          queryUsed: Boolean(query.query),
          ...(query.status ? { status: query.status } : {}),
        },
        page: query.page,
        pageSize: query.pageSize,
        resultCount: users.length,
      },
    });

    return {
      items: users.map((user) => toUserSummaryResponse(user, now)),
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.ceil(total / query.pageSize),
    };
  }

  async getUser(identity: AuthenticatedAdmin, userId: string) {
    const now = new Date();
    const [user, suspensions, hiddenMovieReviewCount, hiddenEpisodeReviewCount] =
      await this.prisma.withConnectionRetry(() => Promise.all([
        this.prisma.user.findUnique({
          select: {
            ...userSummarySelect,
            _count: {
              select: {
                episodeReviews: true,
                movieReviews: true,
                reportsReceived: true,
                suspensions: true,
              },
            },
          },
          where: { id: userId },
        }),
        this.prisma.userSuspension.findMany({
          orderBy: [{ startsAt: 'desc' }, { id: 'desc' }],
          select: {
            createdByEmail: true,
            endsAt: true,
            id: true,
            liftedAt: true,
            liftedByEmail: true,
            liftedNote: true,
            note: true,
            reportId: true,
            startsAt: true,
          },
          take: 100,
          where: { userId },
        }),
        this.prisma.userMovieReview.count({
          where: { moderationHiddenAt: { not: null }, userId },
        }),
        this.prisma.userEpisodeReview.count({
          where: { moderationHiddenAt: { not: null }, userId },
        }),
      ]));

    if (!user) {
      throw new NotFoundException('User not found.');
    }

    await this.writeAudit(identity, AdminAuditAction.USER_VIEWED, {
      reportedUserId: userId,
    });

    return {
      ...toUserSummaryResponse(user, now),
      content: {
        hiddenReviewCount: hiddenMovieReviewCount + hiddenEpisodeReviewCount,
        reviewCount: user._count.movieReviews + user._count.episodeReviews,
      },
      suspensionHistory: suspensions.map((suspension) => ({
        createdByEmail: suspension.createdByEmail,
        endsAt: suspension.endsAt?.toISOString() ?? null,
        id: suspension.id,
        liftedAt: suspension.liftedAt?.toISOString() ?? null,
        liftedByEmail: suspension.liftedByEmail,
        liftedNote: suspension.liftedNote,
        note: suspension.note,
        reportId: suspension.reportId,
        startsAt: suspension.startsAt.toISOString(),
      })),
    };
  }

  async suspendUser(
    identity: AuthenticatedAdmin,
    userId: string,
    input: SuspendUserDto,
  ) {
    const note = normalizeAdminNote(input.note);

    return this.prisma.withConnectionRetry(() =>
      this.prisma.$transaction(async (transaction) => {
        const state = await createUserSuspension(
          transaction,
          userId,
          input.duration,
          note,
          identity,
        );

        await transaction.adminAuditLog.create({
          data: {
            action: AdminAuditAction.USER_SUSPENDED,
            actorEmail: identity.email,
            actorFirebaseUid: identity.firebaseUid,
            metadata: {
              duration: input.duration,
              endsAt: state.suspendedUntil?.toISOString() ?? null,
              note,
              source: 'userRegistry',
            },
            reportedUserId: userId,
          },
        });

        return toSuspensionStateResponse(state);
      }),
    );
  }

  async reactivateUser(
    identity: AuthenticatedAdmin,
    userId: string,
    input: ReactivateUserDto,
  ) {
    const note = normalizeAdminNote(input.note);

    return this.prisma.withConnectionRetry(() =>
      this.prisma.$transaction(async (transaction) => {
        const state = await liftUserSuspension(transaction, userId, note, identity);

        await transaction.adminAuditLog.create({
          data: {
            action: AdminAuditAction.USER_REACTIVATED,
            actorEmail: identity.email,
            actorFirebaseUid: identity.firebaseUid,
            metadata: { note, source: 'userRegistry' },
            reportedUserId: userId,
          },
        });

        return toSuspensionStateResponse(state);
      }),
    );
  }

  private async getModerationState(report: SelectedReport) {
    if (report.targetType === ReportTargetType.PROFILE) {
      return isAccountSuspended(report.reportedUser) ? 'suspended' : 'active';
    }

    const target = report.targetType === ReportTargetType.MOVIE_REVIEW
      ? await this.prisma.withConnectionRetry(() =>
          this.prisma.userMovieReview.findUnique({
            select: { moderationHiddenAt: true },
            where: { id: report.targetId },
          }),
        )
      : await this.prisma.withConnectionRetry(() =>
          this.prisma.userEpisodeReview.findUnique({
            select: { moderationHiddenAt: true },
            where: { id: report.targetId },
          }),
        );

    if (!target) return 'unavailable';
    return target.moderationHiddenAt ? 'hidden' : 'visible';
  }

  private writeAudit(
    identity: AuthenticatedAdmin,
    action: AdminAuditAction,
    input: {
      metadata?: Prisma.InputJsonValue;
      reportId?: string;
      reportedUserId?: string;
    },
  ) {
    return this.prisma.withConnectionRetry(() =>
      this.prisma.adminAuditLog.create({
        data: {
          action,
          actorEmail: identity.email,
          actorFirebaseUid: identity.firebaseUid,
          metadata: input.metadata,
          reportId: input.reportId,
          reportedUserId: input.reportedUserId,
        },
      }),
    );
  }
}

function buildReportWhere(query: ListReportsQuery): Prisma.ContentReportWhereInput {
  const search = query.query;

  return {
    ...(query.reason ? { reason: toPrismaReason(query.reason) } : {}),
    ...(query.status ? { status: toPrismaStatus(query.status) } : {}),
    ...(query.targetType ? { targetType: toPrismaTargetType(query.targetType) } : {}),
    ...(search
      ? {
          OR: [
            { details: { contains: search, mode: 'insensitive' } },
            { reporter: { is: { displayName: { contains: search, mode: 'insensitive' } } } },
            { reporter: { is: { handle: { contains: search, mode: 'insensitive' } } } },
            {
              reportedUser: {
                is: { displayName: { contains: search, mode: 'insensitive' } },
              },
            },
            { reportedUser: { is: { handle: { contains: search, mode: 'insensitive' } } } },
            ...(isUuid(search) ? [{ id: search }, { targetId: search }] : []),
          ],
        }
      : {}),
  };
}

function buildUserWhere(query: ListUsersQuery, now: Date): Prisma.UserWhereInput {
  const filters: Prisma.UserWhereInput[] = [];

  if (query.status === 'active') {
    filters.push(activeAccountWhere(now));
  } else if (query.status === 'suspended') {
    filters.push(suspendedAccountWhere(now));
  } else if (query.status === 'previouslySuspended') {
    filters.push(activeAccountWhere(now), { suspensions: { some: {} } });
  }

  if (query.query) {
    filters.push({
      OR: [
        { displayName: { contains: query.query, mode: 'insensitive' } },
        { handle: { contains: query.query, mode: 'insensitive' } },
        {
          authIdentities: {
            some: { email: { contains: query.query, mode: 'insensitive' } },
          },
        },
        {
          authIdentities: {
            some: { providerUserId: { contains: query.query, mode: 'insensitive' } },
          },
        },
        ...(isUuid(query.query) ? [{ id: query.query }] : []),
      ],
    });
  }

  return filters.length > 0 ? { AND: filters } : {};
}

function toReportResponse(report: SelectedReport) {
  return {
    createdAt: report.createdAt.toISOString(),
    details: report.details,
    id: report.id,
    reason: toApiReason(report.reason),
    reportedUser: {
      displayName: report.reportedUser.displayName,
      handle: report.reportedUser.handle,
      id: report.reportedUser.id,
    },
    reporter: report.reporter,
    resolvedAt: report.resolvedAt?.toISOString() ?? null,
    status: toApiStatus(report.status),
    targetId: report.targetId,
    targetSnapshot: report.targetSnapshot,
    targetType: toApiTargetType(report.targetType),
    updatedAt: report.updatedAt.toISOString(),
  };
}

function toUserSummaryResponse(user: SelectedUserSummary, now: Date) {
  const suspended = isAccountSuspended(user, now);

  return {
    createdAt: user.createdAt.toISOString(),
    displayName: user.displayName,
    emails: user.authIdentities.flatMap((identity) => identity.email ? [identity.email] : []),
    handle: user.handle,
    id: user.id,
    identities: user.authIdentities.map((identity) => ({
      email: identity.email,
      provider: identity.provider.toLowerCase(),
      providerUserId: identity.providerUserId,
    })),
    reportCount: user._count.reportsReceived,
    status: suspended
      ? 'suspended'
      : user._count.suspensions > 0
        ? 'previouslySuspended'
        : 'active',
    suspendedAt: suspended ? user.suspendedAt?.toISOString() ?? null : null,
    suspendedUntil: suspended ? user.suspendedUntil?.toISOString() ?? null : null,
    suspensionCount: user._count.suspensions,
  };
}

function toSuspensionStateResponse(state: {
  suspendedAt: Date | null;
  suspendedUntil: Date | null;
}) {
  return {
    status: isAccountSuspended(state) ? 'suspended' : 'active',
    suspendedAt: state.suspendedAt?.toISOString() ?? null,
    suspendedUntil: state.suspendedUntil?.toISOString() ?? null,
  };
}

function toApiStatus(status: ReportStatus): AdminReportStatus {
  const statuses: Record<ReportStatus, AdminReportStatus> = {
    [ReportStatus.DISMISSED]: 'rejected',
    [ReportStatus.PENDING]: 'new',
    [ReportStatus.RESOLVED]: 'resolved',
    [ReportStatus.REVIEWING]: 'inProgress',
  };

  return statuses[status];
}

function toPrismaStatus(status: AdminReportStatus): ReportStatus {
  const statuses: Record<AdminReportStatus, ReportStatus> = {
    inProgress: ReportStatus.REVIEWING,
    new: ReportStatus.PENDING,
    rejected: ReportStatus.DISMISSED,
    resolved: ReportStatus.RESOLVED,
  };

  return statuses[status];
}

function toApiTargetType(targetType: ReportTargetType): AdminReportTargetType {
  const targetTypes: Record<ReportTargetType, AdminReportTargetType> = {
    [ReportTargetType.EPISODE_REVIEW]: 'episodeReview',
    [ReportTargetType.MOVIE_REVIEW]: 'movieReview',
    [ReportTargetType.PROFILE]: 'profile',
  };

  return targetTypes[targetType];
}

function toPrismaTargetType(targetType: AdminReportTargetType): ReportTargetType {
  const targetTypes: Record<AdminReportTargetType, ReportTargetType> = {
    episodeReview: ReportTargetType.EPISODE_REVIEW,
    movieReview: ReportTargetType.MOVIE_REVIEW,
    profile: ReportTargetType.PROFILE,
  };

  return targetTypes[targetType];
}

function toApiReason(reason: ReportReason): AdminReportReason {
  const reasons: Record<ReportReason, AdminReportReason> = {
    [ReportReason.HARASSMENT]: 'harassment',
    [ReportReason.HATE]: 'hate',
    [ReportReason.IMPERSONATION]: 'impersonation',
    [ReportReason.INTELLECTUAL_PROPERTY]: 'intellectualProperty',
    [ReportReason.OTHER]: 'other',
    [ReportReason.SEXUAL_CONTENT]: 'sexualContent',
    [ReportReason.SPAM]: 'spam',
    [ReportReason.VIOLENCE]: 'violence',
  };

  return reasons[reason];
}

function toPrismaReason(reason: AdminReportReason): ReportReason {
  const reasons: Record<AdminReportReason, ReportReason> = {
    harassment: ReportReason.HARASSMENT,
    hate: ReportReason.HATE,
    impersonation: ReportReason.IMPERSONATION,
    intellectualProperty: ReportReason.INTELLECTUAL_PROPERTY,
    other: ReportReason.OTHER,
    sexualContent: ReportReason.SEXUAL_CONTENT,
    spam: ReportReason.SPAM,
    violence: ReportReason.VIOLENCE,
  };

  return reasons[reason];
}

function toAuditAction(action: AdminAuditAction) {
  const actions: Record<AdminAuditAction, string> = {
    [AdminAuditAction.REPORT_LIST_VIEWED]: 'reportListViewed',
    [AdminAuditAction.REPORT_STATUS_CHANGED]: 'reportStatusChanged',
    [AdminAuditAction.REPORT_VIEWED]: 'reportViewed',
    [AdminAuditAction.USER_LIST_VIEWED]: 'userListViewed',
    [AdminAuditAction.USER_VIEWED]: 'userViewed',
    [AdminAuditAction.USER_SUSPENDED]: 'userSuspended',
    [AdminAuditAction.USER_REACTIVATED]: 'userReactivated',
    [AdminAuditAction.CONTENT_HIDDEN]: 'contentHidden',
    [AdminAuditAction.CONTENT_RESTORED]: 'contentRestored',
  };

  return actions[action];
}

async function applyEnforcement(
  transaction: Prisma.TransactionClient,
  report: SelectedReport,
  input: ApplyModerationActionDto,
  note: string,
  identity: AuthenticatedAdmin,
) {
  switch (input.action) {
    case 'suspendUser': {
      assertProfileAction(report);

      if (!input.duration) {
        throw new BadRequestException('duration is required to suspend an account.');
      }

      await createUserSuspension(
        transaction,
        report.reportedUser.id,
        input.duration,
        note,
        identity,
        report.id,
      );
      return AdminAuditAction.USER_SUSPENDED;
    }
    case 'reactivateUser': {
      assertProfileAction(report);
      await liftUserSuspension(transaction, report.reportedUser.id, note, identity);
      return AdminAuditAction.USER_REACTIVATED;
    }
    case 'hideContent':
      return updateReportedContent(transaction, report, true);
    case 'restoreContent':
      return updateReportedContent(transaction, report, false);
  }
}

async function createUserSuspension(
  transaction: Prisma.TransactionClient,
  userId: string,
  duration: AdminSuspensionDuration,
  note: string,
  identity: AuthenticatedAdmin,
  reportId?: string,
) {
  const existing = await transaction.user.findUnique({
    select: { id: true, suspendedAt: true, suspendedUntil: true },
    where: { id: userId },
  });

  if (!existing) {
    throw new NotFoundException('User not found.');
  }

  if (isAccountSuspended(existing)) {
    throw new ConflictException('Account is already suspended.');
  }

  const startsAt = new Date();
  const endsAt = getSuspensionEnd(duration, startsAt);
  const updated = await transaction.user.update({
    data: { suspendedAt: startsAt, suspendedUntil: endsAt },
    select: { suspendedAt: true, suspendedUntil: true },
    where: { id: userId },
  });

  await transaction.userSuspension.create({
    data: {
      createdByEmail: identity.email,
      createdByFirebaseUid: identity.firebaseUid,
      endsAt,
      note,
      reportId,
      startsAt,
      userId,
    },
  });

  return updated;
}

async function liftUserSuspension(
  transaction: Prisma.TransactionClient,
  userId: string,
  note: string,
  identity: AuthenticatedAdmin,
) {
  const now = new Date();
  const existing = await transaction.user.findUnique({
    select: { id: true, suspendedAt: true, suspendedUntil: true },
    where: { id: userId },
  });

  if (!existing) {
    throw new NotFoundException('User not found.');
  }

  if (!isAccountSuspended(existing, now)) {
    throw new ConflictException('Account is already active.');
  }

  const activeSuspension = await transaction.userSuspension.findFirst({
    orderBy: { startsAt: 'desc' },
    select: { id: true },
    where: {
      liftedAt: null,
      userId,
      OR: [{ endsAt: null }, { endsAt: { gt: now } }],
    },
  });
  const updated = await transaction.user.update({
    data: { suspendedAt: null, suspendedUntil: null },
    select: { suspendedAt: true, suspendedUntil: true },
    where: { id: userId },
  });

  if (activeSuspension) {
    await transaction.userSuspension.update({
      data: {
        liftedAt: now,
        liftedByEmail: identity.email,
        liftedByFirebaseUid: identity.firebaseUid,
        liftedNote: note,
      },
      where: { id: activeSuspension.id },
    });
  }

  return updated;
}

function getSuspensionEnd(duration: AdminSuspensionDuration, startsAt: Date) {
  const milliseconds: Record<Exclude<AdminSuspensionDuration, 'permanent'>, number> = {
    '24Hours': 24 * 60 * 60 * 1000,
    '7Days': 7 * 24 * 60 * 60 * 1000,
    '30Days': 30 * 24 * 60 * 60 * 1000,
  };

  return duration === 'permanent'
    ? null
    : new Date(startsAt.getTime() + milliseconds[duration]);
}

function assertProfileAction(report: SelectedReport) {
  if (report.targetType !== ReportTargetType.PROFILE) {
    throw new BadRequestException('This action only applies to profile reports.');
  }
}

async function updateReportedContent(
  transaction: Prisma.TransactionClient,
  report: SelectedReport,
  hidden: boolean,
) {
  if (report.targetType === ReportTargetType.PROFILE) {
    throw new BadRequestException('This action only applies to review reports.');
  }

  const target = report.targetType === ReportTargetType.MOVIE_REVIEW
    ? await transaction.userMovieReview.findUnique({
        select: { moderationHiddenAt: true, userId: true },
        where: { id: report.targetId },
      })
    : await transaction.userEpisodeReview.findUnique({
        select: { moderationHiddenAt: true, userId: true },
        where: { id: report.targetId },
      });

  if (!target || target.userId !== report.reportedUser.id) {
    throw new NotFoundException('Reported content not found.');
  }

  if (hidden === Boolean(target.moderationHiddenAt)) {
    throw new ConflictException(hidden ? 'Content is already hidden.' : 'Content is already visible.');
  }

  if (report.targetType === ReportTargetType.MOVIE_REVIEW) {
    await transaction.userMovieReview.update({
      data: { moderationHiddenAt: hidden ? new Date() : null },
      where: { id: report.targetId },
    });
  } else {
    await transaction.userEpisodeReview.update({
      data: { moderationHiddenAt: hidden ? new Date() : null },
      where: { id: report.targetId },
    });
  }

  return hidden ? AdminAuditAction.CONTENT_HIDDEN : AdminAuditAction.CONTENT_RESTORED;
}

function normalizeAdminNote(value: string) {
  const note = value.trim();

  if (note.length < 3) {
    throw new BadRequestException('note must contain at least 3 non-whitespace characters.');
  }

  return note;
}

function isClosedStatus(status: ReportStatus) {
  return status === ReportStatus.RESOLVED || status === ReportStatus.DISMISSED;
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}
