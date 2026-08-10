import { apiPost } from './client';

export type ReportTargetType = 'profile' | 'movieReview' | 'episodeReview';
export type ReportReason =
  | 'spam'
  | 'harassment'
  | 'hate'
  | 'sexualContent'
  | 'violence'
  | 'impersonation'
  | 'intellectualProperty'
  | 'other';

export type ReportTarget = {
  id: string;
  label: string;
  type: ReportTargetType;
};

export type ReportReceipt = {
  createdAt: string;
  id: string;
  status: 'pending';
  targetType: ReportTargetType;
};

export function submitReport(
  token: string,
  target: ReportTarget,
  reason: ReportReason,
  details: string | null,
) {
  return apiPost<ReportReceipt>(
    '/reports',
    {
      ...(details ? { details } : {}),
      reason,
      targetId: target.id,
      targetType: target.type,
    },
    { token },
  );
}
