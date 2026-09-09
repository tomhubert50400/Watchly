import regions from './watchRegions.json';

export const watchRegions = [...regions].sort((a, b) => a.name.localeCompare(b.name, 'en'));

export function normalizeWatchRegion(value: string | null | undefined) {
  const code = value?.trim().toUpperCase();
  return watchRegions.find((region) => region.code === code || region.alpha3 === code)?.code ?? null;
}

export function resolveWatchRegion(override: string | null, storefront: string | null) {
  return normalizeWatchRegion(override) ?? normalizeWatchRegion(storefront);
}
