export type ReportStatus = 'new' | 'inProgress' | 'resolved' | 'rejected';
export type ReportTargetType = 'profile' | 'movieReview' | 'episodeReview';
export type ModerationActionName = 'suspendUser' | 'reactivateUser' | 'hideContent' | 'restoreContent';
export type ModerationState = 'active' | 'suspended' | 'visible' | 'hidden' | 'unavailable';
export type SuspensionDuration = '24Hours' | '7Days' | '30Days' | 'permanent';
export type UserModerationStatus = 'active' | 'suspended' | 'previouslySuspended';
export type ReportReason =
  | 'spam'
  | 'harassment'
  | 'hate'
  | 'sexualContent'
  | 'violence'
  | 'impersonation'
  | 'intellectualProperty'
  | 'other';

export type ReportPerson = {
  displayName: string | null;
  handle: string | null;
  id: string;
};

export type ReportSummary = {
  createdAt: string;
  details: string | null;
  id: string;
  reason: ReportReason;
  reportedUser: ReportPerson;
  reporter: ReportPerson;
  resolvedAt: string | null;
  status: ReportStatus;
  targetId: string;
  targetSnapshot: unknown;
  targetType: ReportTargetType;
  updatedAt: string;
};

export type AuditEntry = {
  action:
    | 'reportListViewed'
    | 'reportViewed'
    | 'reportStatusChanged'
    | 'userSuspended'
    | 'userReactivated'
    | 'contentHidden'
    | 'contentRestored';
  actorEmail: string;
  createdAt: string;
  id: string;
  metadata: unknown;
};

export type ReportDetail = ReportSummary & {
  auditTrail: AuditEntry[];
  moderationEndsAt: string | null;
  moderationState: ModerationState;
};

export type ReportPage = {
  items: ReportSummary[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type ReportFilters = {
  query: string;
  reason: ReportReason | '';
  status: ReportStatus | '';
  targetType: ReportTargetType | '';
};

export type AdminSession = {
  email: string;
  mfaVerified: true;
  secondFactor: string;
};

export type AdminUserIdentity = {
  email: string | null;
  provider: string;
  providerUserId: string;
};

export type AdminUserSummary = {
  createdAt: string;
  displayName: string | null;
  emails: string[];
  handle: string | null;
  id: string;
  identities: AdminUserIdentity[];
  reportCount: number;
  status: UserModerationStatus;
  suspendedAt: string | null;
  suspendedUntil: string | null;
  suspensionCount: number;
};

export type UserSuspensionHistoryEntry = {
  createdByEmail: string;
  endsAt: string | null;
  id: string;
  liftedAt: string | null;
  liftedByEmail: string | null;
  liftedNote: string | null;
  note: string;
  reportId: string | null;
  startsAt: string;
};

export type AdminUserDetail = AdminUserSummary & {
  content: {
    hiddenReviewCount: number;
    reviewCount: number;
  };
  suspensionHistory: UserSuspensionHistoryEntry[];
};

export type AdminUserPage = {
  items: AdminUserSummary[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type UserFilters = {
  query: string;
  status: UserModerationStatus | '';
};
