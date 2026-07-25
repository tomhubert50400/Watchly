import {
  CatalogueMovieSectionsResponse,
  getCatalogueMovieSections,
} from '../api/catalogue';
import {
  getMemoryResource,
  getOrCreateResourceRequest,
  isMemoryResourceFresh,
  setMemoryResource,
} from '../cache/memoryResourceCache';
import { getPublicCacheKey } from '../cache/persistedCache';

export const PUBLIC_CATALOGUE_SECTIONS_KEY = getPublicCacheKey('catalogue:movie-sections:v3');
const CATALOGUE_SECTIONS_STALE_TIME_MS = 15 * 60 * 1000;

export function loadCatalogueSections(): Promise<CatalogueMovieSectionsResponse> {
  return getCatalogueMovieSections();
}

export async function ensureCatalogueSections(): Promise<CatalogueMovieSectionsResponse> {
  const existing = getMemoryResource<CatalogueMovieSectionsResponse>(PUBLIC_CATALOGUE_SECTIONS_KEY);
  if (existing && isMemoryResourceFresh(existing.savedAt, CATALOGUE_SECTIONS_STALE_TIME_MS)) {
    return existing.data;
  }

  const data = await getOrCreateResourceRequest(
    PUBLIC_CATALOGUE_SECTIONS_KEY,
    getCatalogueMovieSections,
  );
  setMemoryResource(PUBLIC_CATALOGUE_SECTIONS_KEY, data, new Date().toISOString());
  return data;
}
