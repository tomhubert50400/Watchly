import { getMemoryResource, isMemoryResourceFresh } from '../cache/memoryResourceCache';
import type { SearchableProfileReview } from './profileReviewsModel';

export const PROFILE_REVIEWS_CACHE_TTL_MS = 5 * 60 * 1000;

export type ProfileReviewsCache = {
  items: SearchableProfileReview[];
  hydratedCount: number;
};

export function getCachedProfileReviews(key: string, now = Date.now()) {
  const entry = getMemoryResource<ProfileReviewsCache>(key);
  return entry && isMemoryResourceFresh(entry.savedAt, PROFILE_REVIEWS_CACHE_TTL_MS, now)
    ? entry
    : null;
}
