import {
  EpisodeDetailsResponse,
  getEpisodeDetails,
  getSeasonDetails,
  SeasonDetailsResponse,
} from '../api/catalogue';
import {
  getMemoryResource,
  getOrCreateResourceRequest,
  isMemoryResourceFresh,
  setMemoryResource,
} from '../cache/memoryResourceCache';
import { getPublicCacheKey } from '../cache/persistedCache';

const CATALOGUE_DETAIL_STALE_TIME_MS = 6 * 60 * 60 * 1000;

export function getSeasonResourceKey(tmdbId: number, seasonNumber: number) {
  assertPositiveInteger(tmdbId, 'TMDB ID');
  assertNonNegativeInteger(seasonNumber, 'Season number');
  return getPublicCacheKey(`catalogue:series:${tmdbId}:season:${seasonNumber}:v2`);
}

export function getEpisodeResourceKey(tmdbId: number, seasonNumber: number, episodeNumber: number) {
  assertPositiveInteger(tmdbId, 'TMDB ID');
  assertNonNegativeInteger(seasonNumber, 'Season number');
  assertPositiveInteger(episodeNumber, 'Episode number');
  return getPublicCacheKey(
    `catalogue:series:${tmdbId}:season:${seasonNumber}:episode:${episodeNumber}:v2`,
  );
}

export function ensureSeasonDetails(tmdbId: number, seasonNumber: number) {
  const key = getSeasonResourceKey(tmdbId, seasonNumber);
  return ensureCatalogueResource<SeasonDetailsResponse>(
    key,
    () => getSeasonDetails(tmdbId, seasonNumber),
  );
}

export function ensureEpisodeDetails(tmdbId: number, seasonNumber: number, episodeNumber: number) {
  const key = getEpisodeResourceKey(tmdbId, seasonNumber, episodeNumber);
  return ensureCatalogueResource<EpisodeDetailsResponse>(
    key,
    () => getEpisodeDetails(tmdbId, seasonNumber, episodeNumber),
  );
}

async function ensureCatalogueResource<T>(key: string, load: () => Promise<T>) {
  const existing = getMemoryResource<T>(key);
  if (existing && isMemoryResourceFresh(existing.savedAt, CATALOGUE_DETAIL_STALE_TIME_MS)) {
    return existing.data;
  }

  const data = await getOrCreateResourceRequest(key, load);
  setMemoryResource(key, data, new Date().toISOString());
  return data;
}

function assertPositiveInteger(value: number, label: string) {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${label} must be a positive integer.`);
  }
}

function assertNonNegativeInteger(value: number, label: string) {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative integer.`);
  }
}
