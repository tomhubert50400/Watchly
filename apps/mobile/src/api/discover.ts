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

export const browseGenres = [ 'drama', 'comedy', 'crime', 'mystery', 'animation', 'documentary', 'family', 'sci-fi-fantasy', 'action-adventure' ] as const;
export type BrowseFilters = { mood?: DiscoverMood; genre?: typeof browseGenres[number]; decade?: number; awards?: boolean };
export function collectionFilters(id?: string): BrowseFilters {
  return id === '2000s' ? { decade: 2000 } : id === '1990s' ? { decade: 1990 } : id === 'animation' ? { genre: 'animation' } : id === 'award-winners' ? { awards: true } : {};
}
export function browseQuery(filters: BrowseFilters) {
  const query = new URLSearchParams();
  if (filters.mood) query.set('mood', filters.mood);
  if (filters.genre) query.set('genre', filters.genre);
  if (filters.decade) query.set('decade', String(filters.decade));
  if (filters.awards) query.set('awards', 'true');
  return query.toString();
}
export const browseResourceKey = (filters: BrowseFilters) => `discover:browse:${browseQuery(filters)}:v1`;
export function getDiscoverBrowse(token: string | null, filters: BrowseFilters, page = 1) {
  return apiGet<DiscoverCollectionResponse>(`/catalog/discover/browse?${browseQuery(filters)}&page=${page}`, { ...(token ? { token } : {}), timeoutMs: 30_000 });
}

export const browseGenreLabel = (genre: string) => genre === 'sci-fi-fantasy' ? 'Sci-Fi & fantasy' : genre === 'action-adventure' ? 'Action & adventure' : genre[0].toUpperCase() + genre.slice(1);
