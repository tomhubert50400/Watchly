import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export const REPORT_TARGET_TYPES = ['profile', 'movieReview', 'episodeReview'] as const;
export const REPORT_REASONS = [
  'spam',
  'harassment',
  'hate',
  'sexualContent',
  'violence',
  'impersonation',
  'intellectualProperty',
  'other',
] as const;

export type ReportTargetTypeValue = typeof REPORT_TARGET_TYPES[number];
export type ReportReasonValue = typeof REPORT_REASONS[number];

export class SubmitReportDto {
  @IsIn(REPORT_TARGET_TYPES)
  targetType!: ReportTargetTypeValue;

  @IsUUID()
  targetId!: string;

  @IsIn(REPORT_REASONS)
  reason!: ReportReasonValue;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  details?: string;
}
