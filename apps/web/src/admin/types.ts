export type ReportStatus = 'new' | 'inProgress' | 'resolved' | 'rejected';
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
  action: 'reportListViewed' | 'reportViewed' | 'reportStatusChanged';
  actorEmail: string;
  createdAt: string;
  id: string;
  metadata: unknown;
};

export type ReportDetail = ReportSummary & {
  auditTrail: AuditEntry[];
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
