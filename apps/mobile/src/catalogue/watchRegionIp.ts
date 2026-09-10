import { normalizeWatchRegion } from './watchRegionModel';

export async function fetchWatchRegionCountry(): Promise<string | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch('https://api.country.is/', {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
    if (!response.ok) return null;
    const data = await response.json();
    return typeof data?.country === 'string' ? normalizeWatchRegion(data.country) : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
