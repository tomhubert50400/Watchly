const apiUrl = process.env.EXPO_PUBLIC_API_URL;

export class ApiError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function apiGet<T>(path: string): Promise<T> {
  if (!apiUrl) {
    throw new ApiError('EXPO_PUBLIC_API_URL is not configured.');
  }

  let response: Response;

  try {
    response = await fetch(`${apiUrl}${path}`);
  } catch {
    throw new ApiError('Could not reach the API.');
  }

  if (!response.ok) {
    throw new ApiError(`API request failed with status ${response.status}.`, response.status);
  }

  return response.json() as Promise<T>;
}
