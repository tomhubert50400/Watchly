import {
  getMemoryResource,
  getOrCreateResourceRequest,
  isMemoryResourceFresh,
  setMemoryResource,
} from '../cache/memoryResourceCache';

const CATALOGUE_STALE_TIME_MS = 5 * 60 * 1000;

export async function loadCachedCatalogueResource<T>(
  key: string,
  load: () => Promise<T>,
): Promise<T> {
  const cached = getMemoryResource<T>(key);

  if (cached && isMemoryResourceFresh(cached.savedAt, CATALOGUE_STALE_TIME_MS)) {
    return cached.data;
  }

  return getOrCreateResourceRequest(`${key}:catalogue-load`, async () => {
    const data = await load();
    setMemoryResource(key, data, new Date().toISOString());
    return data;
  });
}
