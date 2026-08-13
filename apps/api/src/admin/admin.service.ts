import {
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
  AdminReportReason,
  AdminReportStatus,
  AdminReportTargetType,
  ListReportsQuery,
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
    };
  }

  async updateReportStatus(
    identity: AuthenticatedAdmin,
    reportId: string,
    input: UpdateReportStatusDto,
  ) {
    const nextStatus = toPrismaStatus(input.status);
    const note = input.note.trim();

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

function toReportResponse(report: SelectedReport) {
  return {
    createdAt: report.createdAt.toISOString(),
    details: report.details,
    id: report.id,
    reason: toApiReason(report.reason),
    reportedUser: report.reportedUser,
    reporter: report.reporter,
    resolvedAt: report.resolvedAt?.toISOString() ?? null,
    status: toApiStatus(report.status),
    targetId: report.targetId,
    targetSnapshot: report.targetSnapshot,
    targetType: toApiTargetType(report.targetType),
    updatedAt: report.updatedAt.toISOString(),
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
  };

  return actions[action];
}

function isClosedStatus(status: ReportStatus) {
  return status === ReportStatus.RESOLVED || status === ReportStatus.DISMISSED;
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}
