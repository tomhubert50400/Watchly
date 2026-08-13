import type { ReportReason, ReportStatus, ReportTargetType } from './types';

export const statusLabels: Record<ReportStatus, string> = {
  inProgress: 'In progress',
  new: 'New',
  rejected: 'Rejected',
  resolved: 'Resolved',
};

export const reasonLabels: Record<ReportReason, string> = {
  harassment: 'Harassment',
  hate: 'Hate',
  impersonation: 'Impersonation',
  intellectualProperty: 'Intellectual property',
  other: 'Other',
  sexualContent: 'Sexual content',
  spam: 'Spam',
  violence: 'Violence',
};

export const targetTypeLabels: Record<ReportTargetType, string> = {
  episodeReview: 'Episode review',
  movieReview: 'Movie review',
  profile: 'Profile',
};

export type ModerationAction = {
  label: string;
  status: ReportStatus;
  tone: 'neutral' | 'positive' | 'negative';
};

export function getModerationActions(status: ReportStatus): ModerationAction[] {
  switch (status) {
    case 'new':
      return [
        { label: 'Start review', status: 'inProgress', tone: 'neutral' },
        { label: 'Resolve', status: 'resolved', tone: 'positive' },
        { label: 'Reject', status: 'rejected', tone: 'negative' },
      ];
    case 'inProgress':
      return [
        { label: 'Resolve', status: 'resolved', tone: 'positive' },
        { label: 'Reject', status: 'rejected', tone: 'negative' },
      ];
    case 'rejected':
    case 'resolved':
      return [{ label: 'Reopen', status: 'inProgress', tone: 'neutral' }];
  }
}

export function getPersonLabel(person: { displayName: string | null; handle: string | null }) {
  if (person.displayName && person.handle) return `${person.displayName} (@${person.handle})`;
  if (person.displayName) return person.displayName;
  if (person.handle) return `@${person.handle}`;
  return 'Unnamed member';
}
