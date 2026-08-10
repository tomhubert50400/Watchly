import type { ReportReason } from '../api/reports';

export const MAX_REPORT_DETAILS_LENGTH = 500;

export const REPORT_REASON_OPTIONS: readonly {
  label: string;
  value: ReportReason;
}[] = [
  { label: 'Spam or scam', value: 'spam' },
  { label: 'Harassment or bullying', value: 'harassment' },
  { label: 'Hate speech', value: 'hate' },
  { label: 'Sexual content', value: 'sexualContent' },
  { label: 'Violence or dangerous content', value: 'violence' },
  { label: 'Impersonation', value: 'impersonation' },
  { label: 'Copyright or stolen content', value: 'intellectualProperty' },
  { label: 'Something else', value: 'other' },
];

export function normalizeReportDetails(value: string) {
  const normalized = value.trim();

  return normalized.length > 0 ? normalized : null;
}
