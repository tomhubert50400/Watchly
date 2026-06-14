const apiUrl = process.env.EXPO_PUBLIC_API_URL;

type ApiRequestOptions = {
  body?: unknown;
  token?: string;
};

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

  let response: Response;

  try {
    response = await fetch(`${apiUrl}${path}`, {
      body: options.body ? JSON.stringify(options.body) : undefined,
      headers: {
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      },
      method,
    });
  } catch {
    throw new ApiError('Could not reach the API.');
  }

  if (!response.ok) {
    const serverMessage = await getServerMessage(response);

    throw new ApiError(
      serverMessage ?? `API request failed with status ${response.status}.`,
      response.status,
      serverMessage,
    );
  }

  return response.json() as Promise<T>;
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
