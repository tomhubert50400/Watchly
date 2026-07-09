import { publicEnv } from '../config/publicEnv';

const apiUrl = publicEnv.EXPO_PUBLIC_API_URL;

type ApiRequestOptions = {
  body?: unknown;
  timeoutMs?: number;
  token?: string;
};

const DEFAULT_REQUEST_TIMEOUT_MS = 15_000;

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly serverMessage?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function apiGet<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  return apiRequest<T>('GET', path, options);
}

export function apiPost<T>(path: string, body: unknown, options: ApiRequestOptions = {}): Promise<T> {
  return apiRequest<T>('POST', path, { ...options, body });
}

export function apiPut<T>(path: string, body: unknown, options: ApiRequestOptions = {}): Promise<T> {
  return apiRequest<T>('PUT', path, { ...options, body });
}

export function apiDelete<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  return apiRequest<T>('DELETE', path, options);
}

async function apiRequest<T>(method: string, path: string, options: ApiRequestOptions = {}): Promise<T> {
  if (!apiUrl) {
    throw new ApiError('EXPO_PUBLIC_API_URL is not configured.');
  }

  const timeoutMs = options.timeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;

  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new ApiError('API request timeout must be a positive finite number.');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${apiUrl}${path}`, {
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      headers: {
        ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(options.token ? { Authorization: ['Bearer', options.token].join(' ') } : {}),
      },
      method,
      signal: controller.signal,
    });

    if (!response.ok) {
      const serverMessage = await getServerMessage(response);

      if (controller.signal.aborted) {
        throw new ApiError('API request timed out.');
      }

      const message = sanitizeServerMessage(serverMessage, response.status);

      throw new ApiError(
        message,
        response.status,
        serverMessage,
      );
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }

    if (controller.signal.aborted) {
      throw new ApiError('API request timed out.');
    }

    throw new ApiError('Could not reach the API.');
  } finally {
    clearTimeout(timeout);
  }
}

async function getServerMessage(response: Response) {
  try {
    const body = (await response.json()) as { message?: unknown };

    if (typeof body.message === 'string') {
      return body.message;
    }

    if (Array.isArray(body.message)) {
      return body.message.filter((item) => typeof item === 'string').join(' ');
    }
  } catch {
    return undefined;
  }

  return undefined;
}

function sanitizeServerMessage(message: string | undefined, status: number) {
  if (!message) {
    return `API request failed with status ${status}.`;
  }

  if (isTechnicalServerMessage(message)) {
    return 'Something went wrong on the server. Try again.';
  }

  return message;
}

function isTechnicalServerMessage(message: string) {
  return (
    message.includes('Invalid `') ||
    message.includes('Prisma') ||
    message.includes('C:\\') ||
    message.includes('/src/') ||
    message.includes('Server has closed the connection') ||
    message.includes('Connection terminated unexpectedly')
  );
}
