import regions from './watchRegions.json';

export const watchRegions = [...regions].sort((a, b) => a.name.localeCompare(b.name, 'en'));

export function normalizeWatchRegion(value: string | null | undefined) {
  const code = value?.trim().toUpperCase();
  return watchRegions.find((region) => region.code === code || region.alpha3 === code)?.code ?? null;
}

export const watchRegionOverrideDuration = 2 * 60 * 60 * 1000;
export type WatchRegionOverride = { country: string; expiresAt: number };

export function activeWatchRegionOverride(override: WatchRegionOverride | null, now = Date.now()) {
  return override && override.expiresAt > now ? normalizeWatchRegion(override.country) : null;
}

export function readWatchRegionOverride(value: string | null): WatchRegionOverride | null {
  try {
    const parsed = JSON.parse(value ?? 'null');
    const country = typeof parsed?.country === 'string' ? normalizeWatchRegion(parsed.country) : null;
    return country && typeof parsed.expiresAt === 'number' && Number.isFinite(parsed.expiresAt)
      ? { country, expiresAt: parsed.expiresAt }
      : null;
  } catch {
    return null;
  }
}

export function resolveWatchRegion(override: WatchRegionOverride | null, ipCountry: string | null, now = Date.now()) {
  return activeWatchRegionOverride(override, now) ?? normalizeWatchRegion(ipCountry);
}
