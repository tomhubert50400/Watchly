import { StructuredLogger } from './structured-logger';
import { resolveRequestId, runWithRequestContext } from './request-context';

type ObservableRequest = {
  headers: Record<string, string | string[] | undefined>;
  method?: string;
  originalUrl?: string;
  url?: string;
};

type ObservableResponse = {
  once(event: 'finish', listener: () => void): unknown;
  setHeader(name: string, value: string): unknown;
  statusCode: number;
};

export function createRequestObservabilityMiddleware(
  logger: StructuredLogger,
  now: () => number = Date.now,
) {
  return (request: ObservableRequest, response: ObservableResponse, next: () => void) => {
    const requestId = resolveRequestId(request.headers['x-request-id']);
    const startedAt = now();

    response.setHeader('X-Request-Id', requestId);

    runWithRequestContext(requestId, () => {
      response.once('finish', () => {
        logger.write({
          durationMs: Math.max(0, now() - startedAt),
          event: 'http.request',
          level: response.statusCode >= 500 ? 'error' : 'info',
          message: 'HTTP request completed',
          method: request.method ?? 'UNKNOWN',
          path: getRequestPath(request),
          requestId,
          statusCode: response.statusCode,
        });
      });

      next();
    });
  };
}

export function getRequestPath(request: Pick<ObservableRequest, 'originalUrl' | 'url'>) {
  return (request.originalUrl ?? request.url ?? '/').split('?', 1)[0];
}
