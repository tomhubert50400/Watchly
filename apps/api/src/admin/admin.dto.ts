import { IsIn, IsString, MaxLength, MinLength } from 'class-validator';

export const ADMIN_REPORT_STATUSES = ['new', 'inProgress', 'resolved', 'rejected'] as const;
export const ADMIN_REPORT_TARGET_TYPES = ['profile', 'movieReview', 'episodeReview'] as const;
export const ADMIN_REPORT_REASONS = [
  'spam',
  'harassment',
  'hate',
  'sexualContent',
  'violence',
  'impersonation',
  'intellectualProperty',
  'other',
] as const;

export type AdminReportStatus = typeof ADMIN_REPORT_STATUSES[number];
export type AdminReportTargetType = typeof ADMIN_REPORT_TARGET_TYPES[number];
export type AdminReportReason = typeof ADMIN_REPORT_REASONS[number];

export class UpdateReportStatusDto {
  @IsIn(ADMIN_REPORT_STATUSES)
  status!: AdminReportStatus;

  @IsString()
  @MinLength(3)
  @MaxLength(1000)
  note!: string;
}

export type ListReportsQuery = {
  page: number;
  pageSize: number;
  query?: string;
  reason?: AdminReportReason;
  status?: AdminReportStatus;
  targetType?: AdminReportTargetType;
};
