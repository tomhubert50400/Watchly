import type {
  AdminSession,
  ModerationActionName,
  ReportDetail,
  ReportFilters,
  ReportPage,
  ReportStatus,
  ReportSummary,
} from './types';

const apiUrl = process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, '');
const environment = process.env.NEXT_PUBLIC_WATCHLY_ENVIRONMENT?.trim() || 'development';

export class AdminApiError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = 'AdminApiError';
  }
}

export function getAdminSession(token: string) {
  return apiRequest<AdminSession>('/admin/session', token);
}

export function listReports(token: string, filters: ReportFilters, page: number) {
  const search = new URLSearchParams({ page: String(page), pageSize: '25' });

  if (filters.query) search.set('query', filters.query);
  if (filters.reason) search.set('reason', filters.reason);
  if (filters.status) search.set('status', filters.status);
  if (filters.targetType) search.set('targetType', filters.targetType);

  return apiRequest<ReportPage>(`/admin/reports?${search}`, token);
}

export function getReport(token: string, reportId: string) {
  return apiRequest<ReportDetail>(`/admin/reports/${reportId}`, token);
}

export function updateReportStatus(
  token: string,
  reportId: string,
  status: ReportStatus,
  note: string,
) {
  return apiRequest<ReportSummary>(`/admin/reports/${reportId}`, token, {
    body: JSON.stringify({ note, status }),
    headers: { 'Content-Type': 'application/json' },
    method: 'PATCH',
  });
}

export function applyModerationAction(
  token: string,
  reportId: string,
  action: ModerationActionName,
  note: string,
) {
  return apiRequest<ReportSummary>(`/admin/reports/${reportId}/actions`, token, {
    body: JSON.stringify({ action, note }),
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
  });
}

async function apiRequest<T>(path: string, token: string, init: RequestInit = {}): Promise<T> {
  if (!apiUrl) {
    throw new AdminApiError('NEXT_PUBLIC_API_URL is not configured.');
  }

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 15_000);

  try {
    const response = await fetch(`${apiUrl}${path}`, {
      ...init,
      cache: 'no-store',
      headers: {
        ...init.headers,
        Authorization: `Bearer ${token}`,
        'X-Watchly-Environment': environment,
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new AdminApiError(await getErrorMessage(response), response.status);
    }

    return await response.json() as T;
  } catch (error) {
    if (error instanceof AdminApiError) throw error;
    if (controller.signal.aborted) throw new AdminApiError('The request timed out.');
    throw new AdminApiError('Could not reach the Watchly API.');
  } finally {
    window.clearTimeout(timeout);
  }
}

async function getErrorMessage(response: Response) {
  try {
    const body = await response.json() as { message?: unknown };

    if (typeof body.message === 'string') return body.message;
    if (Array.isArray(body.message)) return body.message.filter((item) => typeof item === 'string').join(' ');
  } catch {
    return `Request failed with status ${response.status}.`;
  }

  return `Request failed with status ${response.status}.`;
}
