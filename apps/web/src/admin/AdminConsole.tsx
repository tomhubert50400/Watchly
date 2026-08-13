'use client';

import { FirebaseError } from 'firebase/app';
import {
  Auth,
  GoogleAuthProvider,
  MultiFactorError,
  MultiFactorResolver,
  TotpMultiFactorGenerator,
  TotpSecret,
  User,
  getMultiFactorResolver,
  onAuthStateChanged,
  multiFactor,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronRight,
  Eye,
  FilterX,
  KeyRound,
  LoaderCircle,
  LockKeyhole,
  LogOut,
  Search,
  ShieldCheck,
  X,
} from 'lucide-react';
import Image from 'next/image';
import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import watchlyMark from '../../../mobile/assets/watchly-logo-ui.png';
import {
  AdminApiError,
  applyModerationAction,
  getAdminSession,
  getReport,
  listReports,
  updateReportStatus,
} from './api';
import { getAdminAuth } from './firebase';
import {
  EnforcementAction,
  ModerationAction,
  getEnforcementAction,
  getModerationActions,
  getPersonLabel,
  reasonLabels,
  statusLabels,
  targetTypeLabels,
} from './model';
import type {
  AdminSession,
  AuditEntry,
  ReportDetail,
  ReportFilters,
  ReportPage,
  ReportReason,
  ReportStatus,
  ReportSummary,
  ReportTargetType,
} from './types';

const emptyFilters: ReportFilters = {
  query: '',
  reason: '',
  status: '',
  targetType: '',
};

export function AdminConsole() {
  const [auth, setAuth] = useState<Auth | null>(null);
  const [session, setSession] = useState<AdminSession | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [mfaResolver, setMfaResolver] = useState<MultiFactorResolver | null>(null);
  const [mfaHintUid, setMfaHintUid] = useState<string | null>(null);
  const [enrollmentUser, setEnrollmentUser] = useState<User | null>(null);

  const verifyAdminSession = useCallback(async (candidate: User) => {
    setCheckingSession(true);
    setAuthError(null);

    try {
      const token = await candidate.getIdToken();
      const nextSession = await getAdminSession(token);
      setSession(nextSession);
      setUser(candidate);
      setEnrollmentUser(null);
    } catch (error) {
      setSession(null);
      setUser(null);
      const tokenResult = await candidate.getIdTokenResult().catch(() => null);
      const canEnrollMfa =
        error instanceof AdminApiError &&
        error.status === 403 &&
        tokenResult?.claims.admin === true &&
        multiFactor(candidate).enrolledFactors.length === 0;

      setEnrollmentUser(canEnrollMfa ? candidate : null);
      setAuthError(canEnrollMfa ? null : getAuthAccessMessage(error));
    } finally {
      setCheckingSession(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    let unsubscribe: () => void = () => undefined;

    void getAdminAuth()
      .then((nextAuth) => {
        if (!active) return;
        setAuth(nextAuth);
        unsubscribe = onAuthStateChanged(nextAuth, (candidate) => {
          if (!candidate) {
            setSession(null);
            setUser(null);
            setEnrollmentUser(null);
            setCheckingSession(false);
            return;
          }

          void verifyAdminSession(candidate);
        });
      })
      .catch((error: unknown) => {
        if (!active) return;
        setAuthError(error instanceof Error ? error.message : 'Firebase authentication is unavailable.');
        setCheckingSession(false);
      });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [verifyAdminSession]);

  async function handleSignIn() {
    if (!auth) return;

    setAuthBusy(true);
    setAuthError(null);

    try {
      if (auth.currentUser) await signOut(auth);

      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const credential = await signInWithPopup(auth, provider);
      await verifyAdminSession(credential.user);
    } catch (error) {
      if (isMfaError(error)) {
        const resolver = getMultiFactorResolver(auth, error);
        const totpHint = resolver.hints.find(
          (hint) => hint.factorId === TotpMultiFactorGenerator.FACTOR_ID,
        );

        if (totpHint) {
          setMfaResolver(resolver);
          setMfaHintUid(totpHint.uid);
        } else {
          setAuthError('This administrator has no supported TOTP factor.');
        }
      } else {
        setAuthError(getFirebaseMessage(error));
      }
    } finally {
      setAuthBusy(false);
    }
  }

  async function handleMfa(code: string) {
    if (!mfaResolver || !mfaHintUid) return;

    setAuthBusy(true);
    setAuthError(null);

    try {
      const assertion = TotpMultiFactorGenerator.assertionForSignIn(mfaHintUid, code);
      const credential = await mfaResolver.resolveSignIn(assertion);
      setMfaResolver(null);
      setMfaHintUid(null);
      await verifyAdminSession(credential.user);
    } catch (error) {
      setAuthError(getFirebaseMessage(error));
    } finally {
      setAuthBusy(false);
    }
  }

  async function handleSignOut() {
    if (!auth) return;
    await signOut(auth);
    setSession(null);
    setUser(null);
    setEnrollmentUser(null);
    setAuthError(null);
  }

  if (checkingSession) {
    return <AdminLoading label="Verifying the protected session" />;
  }

  if (enrollmentUser && auth) {
    return (
      <AdminMfaEnrollment
        onComplete={async () => {
          await signOut(auth);
          setEnrollmentUser(null);
          setAuthError('TOTP enrollment completed. Sign in again to verify your second factor.');
        }}
        user={enrollmentUser}
      />
    );
  }

  if (!session || !user) {
    return (
      <AdminLogin
        busy={authBusy}
        error={authError}
        mfaPending={Boolean(mfaResolver && mfaHintUid)}
        onMfa={handleMfa}
        onSignIn={handleSignIn}
      />
    );
  }

  return <ModerationWorkspace onSignOut={handleSignOut} session={session} user={user} />;
}

function AdminMfaEnrollment({
  onComplete,
  user,
}: {
  onComplete(): Promise<void>;
  user: User;
}) {
  const [secret, setSecret] = useState<TotpSecret | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generateSecret() {
    setBusy(true);
    setError(null);

    try {
      const session = await multiFactor(user).getSession();
      setSecret(await TotpMultiFactorGenerator.generateSecret(session));
    } catch (enrollmentError) {
      setError(getFirebaseMessage(enrollmentError));
    } finally {
      setBusy(false);
    }
  }

  async function finishEnrollment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!secret) return;

    setBusy(true);
    setError(null);

    try {
      const assertion = TotpMultiFactorGenerator.assertionForEnrollment(secret, code.trim());
      await multiFactor(user).enroll(assertion, 'Watchly Control');
      await user.getIdToken(true);
      await onComplete();
    } catch (enrollmentError) {
      setError(getFirebaseMessage(enrollmentError));
      setBusy(false);
    }
  }

  return (
    <main className="admin-auth-shell">
      <section aria-labelledby="mfa-enrollment-title" className="admin-login-card">
        <div className="admin-login-card__brand">
          <Image alt="" aria-hidden="true" src={watchlyMark} />
          <strong>WATCHLY CONTROL</strong>
        </div>
        <div className="admin-login-card__icon">
          <KeyRound aria-hidden="true" size={30} strokeWidth={1.6} />
        </div>
        <p className="admin-kicker">Administrator setup</p>
        <h1 id="mfa-enrollment-title">Enroll TOTP</h1>
        <p className="admin-login-card__copy">
          Your server-issued admin claim is valid, but moderation stays locked until this account has a second factor.
        </p>
        {error ? <div className="admin-alert admin-alert--error" role="alert"><AlertTriangle aria-hidden="true" size={17} />{error}</div> : null}
        {!secret ? (
          <button className="admin-primary-button" disabled={busy} onClick={() => void generateSecret()} type="button">
            {busy ? <LoaderCircle aria-hidden="true" className="spin" size={18} /> : <KeyRound aria-hidden="true" size={18} />}
            Generate authenticator key
          </button>
        ) : (
          <form className="mfa-form" onSubmit={finishEnrollment}>
            <label htmlFor="totp-secret">Manual setup key</label>
            <input className="totp-secret" id="totp-secret" readOnly value={secret.secretKey} />
            <p className="mfa-help">Add this key to your authenticator app under “Watchly Control”, then enter the current code below.</p>
            <label htmlFor="totp-enrollment-code">Authenticator code</label>
            <input
              autoComplete="one-time-code"
              id="totp-enrollment-code"
              inputMode="numeric"
              maxLength={8}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))}
              pattern="[0-9]{6,8}"
              placeholder="000000"
              required
              value={code}
            />
            <button className="admin-primary-button" disabled={busy || code.length < 6} type="submit">
              {busy ? <LoaderCircle aria-hidden="true" className="spin" size={18} /> : <ShieldCheck aria-hidden="true" size={18} />}
              Complete MFA enrollment
            </button>
          </form>
        )}
        <p className="admin-login-card__footnote">
          This setup screen trusts the signed Firebase claim only for enrollment. The API continues to deny all moderation data until MFA is present in a new verified token.
        </p>
      </section>
    </main>
  );
}

function AdminLoading({ label }: { label: string }) {
  return (
    <main className="admin-auth-shell">
      <div aria-live="polite" className="admin-auth-card">
        <LoaderCircle aria-hidden="true" className="spin" size={26} />
        <p>{label}</p>
      </div>
    </main>
  );
}

function AdminLogin({
  busy,
  error,
  mfaPending,
  onMfa,
  onSignIn,
}: {
  busy: boolean;
  error: string | null;
  mfaPending: boolean;
  onMfa(code: string): Promise<void>;
  onSignIn(): Promise<void>;
}) {
  const [code, setCode] = useState('');

  function submitMfa(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void onMfa(code.trim());
  }

  return (
    <main className="admin-auth-shell">
      <section aria-labelledby="admin-sign-in-title" className="admin-login-card">
        <div className="admin-login-card__brand">
          <Image alt="" aria-hidden="true" src={watchlyMark} />
          <strong>WATCHLY CONTROL</strong>
        </div>
        <div className="admin-login-card__icon">
          <LockKeyhole aria-hidden="true" size={30} strokeWidth={1.6} />
        </div>
        <p className="admin-kicker">Restricted area</p>
        <h1 id="admin-sign-in-title">Moderation console</h1>
        <p className="admin-login-card__copy">
          Access requires a verified administrator claim and a Firebase multi-factor session.
        </p>

        {error ? (
          <div aria-live="assertive" className="admin-alert admin-alert--error" role="alert">
            <AlertTriangle aria-hidden="true" size={18} />
            <span>{error}</span>
          </div>
        ) : null}

        {mfaPending ? (
          <form className="mfa-form" onSubmit={submitMfa}>
            <label htmlFor="totp-code">Authenticator code</label>
            <input
              autoComplete="one-time-code"
              autoFocus
              id="totp-code"
              inputMode="numeric"
              maxLength={8}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))}
              pattern="[0-9]{6,8}"
              placeholder="000000"
              required
              value={code}
            />
            <button className="admin-primary-button" disabled={busy || code.length < 6} type="submit">
              {busy ? <LoaderCircle aria-hidden="true" className="spin" size={18} /> : <KeyRound aria-hidden="true" size={18} />}
              Verify second factor
            </button>
          </form>
        ) : (
          <button className="admin-primary-button" disabled={busy} onClick={() => void onSignIn()} type="button">
            {busy ? <LoaderCircle aria-hidden="true" className="spin" size={18} /> : <ShieldCheck aria-hidden="true" size={18} />}
            Continue with Google
          </button>
        )}

        <p className="admin-login-card__footnote">
          Authorization is checked by the Watchly API on every request. UI access alone grants no privilege.
        </p>
      </section>
    </main>
  );
}

function ModerationWorkspace({
  onSignOut,
  session,
  user,
}: {
  onSignOut(): Promise<void>;
  session: AdminSession;
  user: User;
}) {
  const [filters, setFilters] = useState<ReportFilters>(emptyFilters);
  const [searchDraft, setSearchDraft] = useState('');
  const [page, setPage] = useState(1);
  const [reportPage, setReportPage] = useState<ReportPage | null>(null);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [detail, setDetail] = useState<ReportDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const loadReportPage = useCallback(async () => {
    setListLoading(true);
    setListError(null);

    try {
      const token = await user.getIdToken();
      setReportPage(await listReports(token, filters, page));
    } catch (error) {
      setListError(getRequestMessage(error));
    } finally {
      setListLoading(false);
    }
  }, [filters, page, user]);

  useEffect(() => {
    let active = true;

    void user.getIdToken()
      .then((token) => listReports(token, filters, page))
      .then((nextPage) => {
        if (active) setReportPage(nextPage);
      })
      .catch((error: unknown) => {
        if (active) setListError(getRequestMessage(error));
      })
      .finally(() => {
        if (active) setListLoading(false);
      });

    return () => {
      active = false;
    };
  }, [filters, page, user]);

  async function openReport(reportId: string) {
    setDetailLoading(true);
    setDetailError(null);

    try {
      const token = await user.getIdToken();
      setDetail(await getReport(token, reportId));
    } catch (error) {
      setDetailError(getRequestMessage(error));
    } finally {
      setDetailLoading(false);
    }
  }

  function updateFilter<K extends keyof ReportFilters>(key: K, value: ReportFilters[K]) {
    setListLoading(true);
    setListError(null);
    setFilters((current) => ({ ...current, [key]: value }));
    setPage(1);
  }

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    updateFilter('query', searchDraft.trim());
  }

  function resetFilters() {
    setListLoading(true);
    setListError(null);
    setFilters(emptyFilters);
    setSearchDraft('');
    setPage(1);
  }

  async function handleStatusChange(action: ModerationAction, note: string) {
    if (!detail) return;
    const token = await user.getIdToken();
    await updateReportStatus(token, detail.id, action.status, note);
    await Promise.all([loadReportPage(), openReport(detail.id)]);
  }

  async function handleEnforcementAction(action: EnforcementAction, note: string) {
    if (!detail) return;
    const token = await user.getIdToken();
    await applyModerationAction(token, detail.id, action.action, note);
    await Promise.all([loadReportPage(), openReport(detail.id)]);
  }

  return (
    <div className="admin-shell">
      <header className="admin-header">
        <div className="admin-brand">
          <Image alt="" aria-hidden="true" src={watchlyMark} />
          <div><strong>WATCHLY</strong><small>Moderation control</small></div>
        </div>
        <div className="admin-session">
          <div>
            <span>{session.email}</span>
            <small><ShieldCheck aria-hidden="true" size={13} /> MFA verified</small>
          </div>
          <button aria-label="Sign out" onClick={() => void onSignOut()} title="Sign out" type="button">
            <LogOut aria-hidden="true" size={18} />
          </button>
        </div>
      </header>

      <main className="admin-main">
        <div className="admin-title-row">
          <div>
            <p className="admin-kicker">Trust and safety</p>
            <h1>Reports</h1>
          </div>
          <div className="admin-count" aria-live="polite">
            <span>{reportPage?.total ?? 0}</span>
            <small>matching reports</small>
          </div>
        </div>

        <form aria-label="Report filters" className="admin-filters" onSubmit={submitSearch}>
          <label className="admin-search" htmlFor="report-search">
            <Search aria-hidden="true" size={17} />
            <span className="sr-only">Search reports</span>
            <input
              id="report-search"
              onChange={(event) => setSearchDraft(event.target.value)}
              placeholder="Search member, handle, report ID"
              value={searchDraft}
            />
          </label>
          <select
            aria-label="Filter by status"
            onChange={(event) => updateFilter('status', event.target.value as ReportStatus | '')}
            value={filters.status}
          >
            <option value="">All statuses</option>
            {typedEntries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <select
            aria-label="Filter by target type"
            onChange={(event) => updateFilter('targetType', event.target.value as ReportTargetType | '')}
            value={filters.targetType}
          >
            <option value="">All content</option>
            {typedEntries(targetTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <select
            aria-label="Filter by reason"
            onChange={(event) => updateFilter('reason', event.target.value as ReportReason | '')}
            value={filters.reason}
          >
            <option value="">All reasons</option>
            {typedEntries(reasonLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <button className="admin-filter-button" type="submit">Apply</button>
          <button aria-label="Reset filters" className="admin-reset-button" onClick={resetFilters} type="button">
            <FilterX aria-hidden="true" size={17} />
          </button>
        </form>

        <div className="moderation-layout">
          <section aria-labelledby="report-list-title" className="report-list-panel">
            <div className="panel-heading">
              <div>
                <h2 id="report-list-title">Queue</h2>
                <p>Newest reports first</p>
              </div>
              {listLoading ? <LoaderCircle aria-hidden="true" className="spin" size={18} /> : null}
            </div>

            {listError ? <InlineError message={listError} onRetry={() => void loadReportPage()} /> : null}
            {!listError && !listLoading && reportPage?.items.length === 0 ? (
              <div className="empty-state"><Check aria-hidden="true" size={24} /><p>No reports match these filters.</p></div>
            ) : null}
            {!listError && reportPage?.items.length ? (
              <ReportTable items={reportPage.items} onOpen={(reportId) => void openReport(reportId)} selectedId={detail?.id} />
            ) : null}

            <div className="pagination">
              <button disabled={page <= 1 || listLoading} onClick={() => { setListLoading(true); setPage((value) => value - 1); }} type="button">
                <ArrowLeft aria-hidden="true" size={16} /> Previous
              </button>
              <span>Page {reportPage?.page ?? page} of {Math.max(reportPage?.totalPages ?? 1, 1)}</span>
              <button
                disabled={listLoading || page >= (reportPage?.totalPages ?? 1)}
                onClick={() => { setListLoading(true); setPage((value) => value + 1); }}
                type="button"
              >
                Next <ArrowRight aria-hidden="true" size={16} />
              </button>
            </div>
          </section>

          <section aria-label="Selected report details" className="report-detail-panel">
            {detailLoading ? <DetailLoading /> : null}
            {!detailLoading && detailError ? <InlineError message={detailError} /> : null}
            {!detailLoading && !detailError && detail ? (
              <ReportDetailView
                detail={detail}
                onEnforcementAction={handleEnforcementAction}
                onStatusChange={handleStatusChange}
              />
            ) : null}
            {!detailLoading && !detailError && !detail ? (
              <div className="detail-placeholder">
                <Eye aria-hidden="true" size={26} strokeWidth={1.5} />
                <h2>Select a report</h2>
                <p>Open an item to inspect the captured context and its audit trail.</p>
              </div>
            ) : null}
          </section>
        </div>
      </main>
    </div>
  );
}

function ReportTable({
  items,
  onOpen,
  selectedId,
}: {
  items: ReportSummary[];
  onOpen(reportId: string): void;
  selectedId?: string;
}) {
  return (
    <div className="report-table-wrap">
      <table className="report-table">
        <caption className="sr-only">Moderation report queue</caption>
        <thead>
          <tr><th>Status</th><th>Target</th><th>Reason</th><th>Reported member</th><th>Received</th><th><span className="sr-only">Action</span></th></tr>
        </thead>
        <tbody>
          {items.map((report) => (
            <tr className={selectedId === report.id ? 'is-selected' : undefined} key={report.id}>
              <td><StatusBadge status={report.status} /></td>
              <td>{targetTypeLabels[report.targetType]}</td>
              <td>{reasonLabels[report.reason]}</td>
              <td>{getPersonLabel(report.reportedUser)}</td>
              <td><time dateTime={report.createdAt}>{formatDate(report.createdAt)}</time></td>
              <td>
                <button aria-label={`Review report about ${getPersonLabel(report.reportedUser)}`} onClick={() => onOpen(report.id)} type="button">
                  <ChevronRight aria-hidden="true" size={18} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ReportDetailView({
  detail,
  onEnforcementAction,
  onStatusChange,
}: {
  detail: ReportDetail;
  onEnforcementAction(action: EnforcementAction, note: string): Promise<void>;
  onStatusChange(action: ModerationAction, note: string): Promise<void>;
}) {
  const [statusConfirmation, setStatusConfirmation] = useState<ModerationAction | null>(null);
  const [enforcementConfirmation, setEnforcementConfirmation] = useState<EnforcementAction | null>(null);
  const enforcementAction = getEnforcementAction(detail.targetType, detail.moderationState);

  return (
    <>
      <div className="detail-heading">
        <div>
          <p className="admin-kicker">Report {detail.id.slice(0, 8)}</p>
          <h2>{targetTypeLabels[detail.targetType]}</h2>
        </div>
        <StatusBadge status={detail.status} />
      </div>

      <dl className="detail-facts">
        <div><dt>Reported member</dt><dd>{getPersonLabel(detail.reportedUser)}</dd></div>
        <div><dt>Reporter</dt><dd>{getPersonLabel(detail.reporter)}</dd></div>
        <div><dt>Reason</dt><dd>{reasonLabels[detail.reason]}</dd></div>
        <div><dt>Received</dt><dd>{formatDateTime(detail.createdAt)}</dd></div>
      </dl>

      <section className="detail-section">
        <h3>Reporter context</h3>
        <p className={detail.details ? 'detail-quote' : 'detail-muted'}>
          {detail.details || 'No additional details were provided.'}
        </p>
      </section>

      <section className="detail-section">
        <h3>Captured evidence</h3>
        <dl className="snapshot-list">
          {getSnapshotEntries(detail.targetSnapshot).map(([key, value]) => (
            <div key={key}><dt>{toSentenceCase(key)}</dt><dd>{value}</dd></div>
          ))}
        </dl>
      </section>

      <section className="detail-section">
        <h3>Enforcement</h3>
        <div className="enforcement-card">
          <div>
            <span>Current state</span>
            <strong>{enforcementAction?.stateLabel ?? 'Target unavailable'}</strong>
            <p>{enforcementAction?.description ?? 'The reported target no longer exists, so no enforcement action can be applied.'}</p>
          </div>
          {enforcementAction ? (
            <button
              className={`moderation-action moderation-action--${enforcementAction.tone}`}
              onClick={() => setEnforcementConfirmation(enforcementAction)}
              type="button"
            >
              {enforcementAction.label}
            </button>
          ) : null}
        </div>
      </section>

      <section className="detail-section">
        <h3>Report workflow</h3>
        <div className="action-row">
          {getModerationActions(detail.status).map((action) => (
            <button className={`moderation-action moderation-action--${action.tone}`} key={action.status} onClick={() => setStatusConfirmation(action)} type="button">
              {action.label}
            </button>
          ))}
        </div>
      </section>

      <section className="detail-section audit-section">
        <h3>Audit trail</h3>
        {detail.auditTrail.length === 0 ? <p className="detail-muted">No earlier activity.</p> : (
          <ol className="audit-list">
            {detail.auditTrail.map((entry) => <AuditTrailEntry entry={entry} key={entry.id} />)}
          </ol>
        )}
      </section>

      {statusConfirmation ? (
        <ConfirmationDialog
          action={statusConfirmation}
          copy="The workflow status change and your reason will be written to the immutable audit trail. This does not apply a sanction by itself."
          onCancel={() => setStatusConfirmation(null)}
          onConfirm={async (note) => {
            await onStatusChange(statusConfirmation, note);
            setStatusConfirmation(null);
          }}
          placeholder="Describe what you reviewed and why this status is appropriate."
          title={`${statusConfirmation.label} this report?`}
        />
      ) : null}

      {enforcementConfirmation ? (
        <ConfirmationDialog
          action={enforcementConfirmation}
          copy={`${enforcementConfirmation.confirmationCopy} The sanction and your reason will be written to the immutable audit trail.`}
          onCancel={() => setEnforcementConfirmation(null)}
          onConfirm={async (note) => {
            await onEnforcementAction(enforcementConfirmation, note);
            setEnforcementConfirmation(null);
          }}
          placeholder="State the evidence and policy basis for this sanction."
          title={`${enforcementConfirmation.label}?`}
        />
      ) : null}
    </>
  );
}

function ConfirmationDialog({
  action,
  copy,
  onCancel,
  onConfirm,
  placeholder,
  title,
}: {
  action: Pick<ModerationAction, 'label' | 'tone'>;
  copy: string;
  onCancel(): void;
  onConfirm(note: string): Promise<void>;
  placeholder: string;
  title: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    dialog?.showModal();

    return () => {
      if (dialog?.open) dialog.close();
    };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    try {
      await onConfirm(note.trim());
    } catch (requestError) {
      setError(getRequestMessage(requestError));
      setBusy(false);
    }
  }

  return (
    <dialog aria-labelledby="confirmation-title" className="confirmation-dialog" onCancel={onCancel} ref={dialogRef}>
      <form onSubmit={submit}>
        <div className="dialog-heading">
          <div>
            <p className="admin-kicker">Confirm action</p>
            <h2 id="confirmation-title">{title}</h2>
          </div>
          <button aria-label="Close confirmation" disabled={busy} onClick={onCancel} type="button"><X aria-hidden="true" size={18} /></button>
        </div>
        <p>{copy}</p>
        <label htmlFor="moderation-note">Reason for this decision</label>
        <textarea
          autoFocus
          id="moderation-note"
          maxLength={1000}
          minLength={3}
          onChange={(event) => setNote(event.target.value)}
          placeholder={placeholder}
          required
          rows={5}
          value={note}
        />
        {error ? <div className="admin-alert admin-alert--error" role="alert"><AlertTriangle aria-hidden="true" size={17} />{error}</div> : null}
        <div className="dialog-actions">
          <button disabled={busy} onClick={onCancel} type="button">Cancel</button>
          <button className={`moderation-action moderation-action--${action.tone}`} disabled={busy || note.trim().length < 3} type="submit">
            {busy ? <LoaderCircle aria-hidden="true" className="spin" size={17} /> : null}
            Confirm {action.label.toLowerCase()}
          </button>
        </div>
      </form>
    </dialog>
  );
}

function AuditTrailEntry({ entry }: { entry: AuditEntry }) {
  const note = getAuditNote(entry.metadata);
  const actionLabels: Record<AuditEntry['action'], string> = {
    contentHidden: 'Hid reported review',
    contentRestored: 'Restored reported review',
    reportListViewed: 'Viewed report queue',
    reportStatusChanged: 'Changed report status',
    reportViewed: 'Viewed sensitive report',
    userReactivated: 'Reactivated reported account',
    userSuspended: 'Suspended reported account',
  };

  return (
    <li>
      <span className="audit-dot" />
      <div>
        <strong>{actionLabels[entry.action]}</strong>
        <span>{entry.actorEmail}</span>
        {note ? <p>{note}</p> : null}
        <time dateTime={entry.createdAt}>{formatDateTime(entry.createdAt)}</time>
      </div>
    </li>
  );
}

function StatusBadge({ status }: { status: ReportStatus }) {
  return <span className={`status-badge status-badge--${status}`}>{statusLabels[status]}</span>;
}

function DetailLoading() {
  return (
    <div aria-live="polite" className="detail-placeholder">
      <LoaderCircle aria-hidden="true" className="spin" size={24} />
      <h2>Loading protected context</h2>
    </div>
  );
}

function InlineError({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="panel-error" role="alert">
      <AlertTriangle aria-hidden="true" size={19} />
      <p>{message}</p>
      {onRetry ? <button onClick={onRetry} type="button">Try again</button> : null}
    </div>
  );
}

function getSnapshotEntries(snapshot: unknown): Array<[string, string]> {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
    return [['Evidence', formatSnapshotValue(snapshot)]];
  }

  const entries = Object.entries(snapshot as Record<string, unknown>);
  return entries.length > 0
    ? entries.map(([key, value]) => [key, formatSnapshotValue(value)])
    : [['Evidence', 'No captured fields.']];
}

function formatSnapshotValue(value: unknown) {
  if (value === null || value === undefined || value === '') return 'Not captured';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value);
  return JSON.stringify(value);
}

function getAuditNote(metadata: unknown) {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return null;
  const note = (metadata as Record<string, unknown>).note;
  return typeof note === 'string' ? note : null;
}

function toSentenceCase(value: string) {
  return value.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (character) => character.toUpperCase());
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value));
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('en', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function typedEntries<T extends Record<string, string>>(value: T) {
  return Object.entries(value) as Array<[keyof T, T[keyof T]]>;
}

function isMfaError(error: unknown): error is MultiFactorError {
  return error instanceof FirebaseError && error.code === 'auth/multi-factor-auth-required';
}

function getFirebaseMessage(error: unknown) {
  if (error instanceof FirebaseError) {
    switch (error.code) {
      case 'auth/popup-closed-by-user':
        return 'Sign-in was cancelled.';
      case 'auth/invalid-verification-code':
        return 'The authenticator code is invalid or expired.';
      case 'auth/too-many-requests':
        return 'Too many attempts. Wait before trying again.';
      default:
        return 'Authentication failed. Try again.';
    }
  }

  return error instanceof Error ? error.message : 'Authentication failed.';
}

function getAuthAccessMessage(error: unknown) {
  if (error instanceof AdminApiError && error.status === 403) {
    return 'Access denied. This account needs a server-issued admin claim, a verified email, and MFA.';
  }

  return getRequestMessage(error);
}

function getRequestMessage(error: unknown) {
  return error instanceof Error ? error.message : 'The request failed.';
}
