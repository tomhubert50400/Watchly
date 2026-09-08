import { apiGet } from './client';
import type { CatalogueSearchItem } from './catalogue';

export const discoverMoods = [
  { id: 'comfort', label: 'Comfort', description: 'Warm and familiar' },
  { id: 'funny', label: 'Light & funny', description: 'An easy laugh' },
  { id: 'suspense', label: 'Suspense', description: 'On the edge of your seat' },
  { id: 'mind-bending', label: 'Mind-bending', description: 'Expect the unexpected' },
  { id: 'emotional', label: 'Emotional', description: 'Feel something deeply' },
  { id: 'romantic', label: 'Romantic', description: 'Fall for a love story' },
  { id: 'adventure', label: 'Adventure', description: 'Escape somewhere else' },
  { id: 'dark', label: 'Dark & unsettling', description: 'Let the unease linger' },
] as const;
export type DiscoverMood = typeof discoverMoods[number]['id'];
export type DiscoverItem = CatalogueSearchItem & { backdropUrl: string | null; genreIds: number[]; reason: string };
export type DiscoverResponse = { items: DiscoverItem[]; personalized: boolean; partial: boolean; mood: DiscoverMood | null };
export type DiscoverCollection = { id: string; title: string; description: string; artwork: (string | null)[] };
export type DiscoverCollectionsResponse = { items: DiscoverCollection[]; partial: boolean };
export type DiscoverCollectionResponse = { items: DiscoverItem[]; hasMore: boolean; partial: boolean };

export function getDiscover(token: string | null, mood: DiscoverMood | null) {
  return apiGet<DiscoverResponse>(`/catalog/discover${mood ? `?mood=${encodeURIComponent(mood)}` : ''}`, { ...(token ? { token } : {}), timeoutMs: 30_000 });
}
export function getDiscoverCollections() { return apiGet<DiscoverCollectionsResponse>('/catalog/discover/collections', { timeoutMs: 30_000 }); }
export function getDiscoverCollection(id: string, page: number) {
  return apiGet<DiscoverCollectionResponse>(`/catalog/discover/collections/${encodeURIComponent(id)}?page=${page}`, { timeoutMs: 30_000 });
}
