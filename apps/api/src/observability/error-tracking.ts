import * as Sentry from '@sentry/node';

type ErrorEvent = {
  request?: {
    cookies?: unknown;
    data?: unknown;
    headers?: unknown;
    query_string?: unknown;
    url?: string;
  };
  user?: unknown;
};

let errorTrackingEnabled = false;

export function initializeErrorTracking(options: {
  dsn?: string;
  environment: string;
  release?: string;
}) {
  const dsn = options.dsn?.trim();
  if (!dsn) return false;

  Sentry.init({
    beforeSend: sanitizeErrorEvent,
    dsn,
    environment: options.environment,
    release: options.release?.trim() || undefined,
    sendDefaultPii: false,
    tracesSampleRate: 0,
  });
  errorTrackingEnabled = true;
  return true;
}

export function captureApiException(
  exception: unknown,
  context: {
    method: string;
    path: string;
    requestId?: string;
    statusCode: number;
  },
) {
  if (!errorTrackingEnabled) return;

  Sentry.withScope((scope) => {
    scope.setContext('request', {
      method: context.method,
      path: context.path,
      statusCode: context.statusCode,
    });
    scope.setTag('http.status_code', String(context.statusCode));
    if (context.requestId) {
      scope.setTag('request.id', context.requestId);
    }
    Sentry.captureException(exception);
  });
}

export function sanitizeErrorEvent<T extends ErrorEvent>(event: T): T {
  if (event.request) {
    delete event.request.cookies;
    delete event.request.data;
    delete event.request.headers;
    delete event.request.query_string;

    if (event.request.url) {
      event.request.url = event.request.url.split('?', 1)[0];
    }
  }

  delete event.user;
  return event;
}
