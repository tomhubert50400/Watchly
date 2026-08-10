import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { AuthenticatedIdentity } from '../auth/auth.types';
import { PrismaService } from '../database/prisma.service';
import {
  ReportReason,
  ReportStatus,
  ReportTargetType,
} from '../generated/prisma/enums';
import {
  ReportReasonValue,
  ReportTargetTypeValue,
  SubmitReportDto,
} from './reports.dto';

@Injectable()
export class ReportsService {
  constructor(
    @Inject(AuthService) private readonly authService: AuthService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  async submitReport(identity: AuthenticatedIdentity, input: SubmitReportDto) {
    const reporter = await this.authService.getOrCreateUser(identity);
    const target = await this.getTarget(input.targetType, input.targetId);

    if (target.reportedUserId === reporter.id) {
      throw new BadRequestException('You cannot report your own profile or review.');
    }

    const targetType = toPrismaTargetType(input.targetType);
    const report = await this.prisma.withConnectionRetry(() =>
      this.prisma.contentReport.upsert({
        create: {
          details: normalizeDetails(input.details),
          reason: toPrismaReason(input.reason),
          reportedUserId: target.reportedUserId,
          reporterId: reporter.id,
          status: ReportStatus.PENDING,
          targetId: input.targetId,
          targetSnapshot: target.snapshot,
          targetType,
        },
        update: {
          details: normalizeDetails(input.details),
          reason: toPrismaReason(input.reason),
          reportedUserId: target.reportedUserId,
          resolvedAt: null,
          status: ReportStatus.PENDING,
          targetSnapshot: target.snapshot,
        },
        where: {
          reporterId_targetType_targetId: {
            reporterId: reporter.id,
            targetId: input.targetId,
            targetType,
          },
        },
      }),
    );

    return {
      createdAt: report.createdAt.toISOString(),
      id: report.id,
      status: 'pending' as const,
      targetType: input.targetType,
    };
  }

  private async getTarget(targetType: ReportTargetTypeValue, targetId: string) {
    switch (targetType) {
      case 'profile': {
        const user = await this.prisma.withConnectionRetry(() =>
          this.prisma.user.findUnique({
            select: { displayName: true, id: true },
            where: { id: targetId },
          }),
        );

        if (!user) throw new NotFoundException('Profile not found.');

        return {
          reportedUserId: user.id,
          snapshot: { displayName: user.displayName, userId: user.id },
        };
      }
      case 'movieReview': {
        const review = await this.prisma.withConnectionRetry(() =>
          this.prisma.userMovieReview.findUnique({
            select: {
              body: true,
              id: true,
              tmdbId: true,
              user: { select: { displayName: true } },
              userId: true,
            },
            where: { id: targetId },
          }),
        );

        if (!review) throw new NotFoundException('Review not found.');

        return {
          reportedUserId: review.userId,
          snapshot: {
            authorDisplayName: review.user.displayName,
            body: review.body,
            reviewId: review.id,
            tmdbId: review.tmdbId,
          },
        };
      }
      case 'episodeReview': {
        const review = await this.prisma.withConnectionRetry(() =>
          this.prisma.userEpisodeReview.findUnique({
            select: {
              body: true,
              episodeNumber: true,
              id: true,
              seasonNumber: true,
              seriesTmdbId: true,
              user: { select: { displayName: true } },
              userId: true,
            },
            where: { id: targetId },
          }),
        );

        if (!review) throw new NotFoundException('Review not found.');

        return {
          reportedUserId: review.userId,
          snapshot: {
            authorDisplayName: review.user.displayName,
            body: review.body,
            episodeNumber: review.episodeNumber,
            reviewId: review.id,
            seasonNumber: review.seasonNumber,
            seriesTmdbId: review.seriesTmdbId,
          },
        };
      }
    }
  }
}

function normalizeDetails(details: string | undefined) {
  const normalized = details?.trim() ?? '';

  return normalized.length > 0 ? normalized : null;
}

function toPrismaTargetType(value: ReportTargetTypeValue) {
  const targetTypes: Record<ReportTargetTypeValue, ReportTargetType> = {
    episodeReview: ReportTargetType.EPISODE_REVIEW,
    movieReview: ReportTargetType.MOVIE_REVIEW,
    profile: ReportTargetType.PROFILE,
  };

  return targetTypes[value];
}

function toPrismaReason(value: ReportReasonValue) {
  const reasons: Record<ReportReasonValue, ReportReason> = {
    harassment: ReportReason.HARASSMENT,
    hate: ReportReason.HATE,
    impersonation: ReportReason.IMPERSONATION,
    intellectualProperty: ReportReason.INTELLECTUAL_PROPERTY,
    other: ReportReason.OTHER,
    sexualContent: ReportReason.SEXUAL_CONTENT,
    spam: ReportReason.SPAM,
    violence: ReportReason.VIOLENCE,
  };

  return reasons[value];
}
