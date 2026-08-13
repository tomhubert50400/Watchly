import type {
  ModerationActionName,
  ModerationState,
  ReportReason,
  ReportStatus,
  ReportTargetType,
} from './types';

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

export type EnforcementAction = {
  action: ModerationActionName;
  confirmationCopy: string;
  description: string;
  label: string;
  stateLabel: string;
  tone: 'positive' | 'negative';
};

export function getEnforcementAction(
  targetType: ReportTargetType,
  state: ModerationState,
): EnforcementAction | null {
  if (targetType === 'profile') {
    if (state === 'active') {
      return {
        action: 'suspendUser',
        confirmationCopy: 'This immediately blocks the member from authenticated Watchly APIs and removes the profile from public discovery.',
        description: 'The member can currently use Watchly and their profile remains public where privacy allows.',
        label: 'Suspend account',
        stateLabel: 'Account active',
        tone: 'negative',
      };
    }

    if (state === 'suspended') {
      return {
        action: 'reactivateUser',
        confirmationCopy: 'This restores the member access to Watchly and makes the profile eligible for public discovery again.',
        description: 'The member is blocked from authenticated Watchly APIs and hidden from public discovery.',
        label: 'Reactivate account',
        stateLabel: 'Account suspended',
        tone: 'positive',
      };
    }
  }

  if (targetType !== 'profile') {
    if (state === 'visible') {
      return {
        action: 'hideContent',
        confirmationCopy: 'This immediately removes the reported review from public Watchly surfaces.',
        description: 'The reported review is currently visible wherever the author privacy settings allow.',
        label: 'Hide review',
        stateLabel: 'Review visible',
        tone: 'negative',
      };
    }

    if (state === 'hidden') {
      return {
        action: 'restoreContent',
        confirmationCopy: 'This makes the reported review eligible for public display again.',
        description: 'The reported review is hidden from public Watchly surfaces.',
        label: 'Restore review',
        stateLabel: 'Review hidden',
        tone: 'positive',
      };
    }
  }

  return null;
}

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
