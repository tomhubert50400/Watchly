import { apiGet } from './client';
import type { DiscoverCollectionResponse } from './discover';
import { getPublicCacheKey } from '../cache/persistedCache';
import { setMemoryResource } from '../cache/memoryResourceCache';

export type HomeCategory = DiscoverCollectionResponse & { id: string; title: string; moviesOnly?: boolean };
export type HomeCategoriesResponse = { items: HomeCategory[]; partial: boolean };

export const homeCategoryResourceKey = (id: string, country?: string | null) => getPublicCacheKey(`home:category:${id}:${country ?? 'global'}:v1`);
export const homeCategoriesResourceKey = (country: string | null) => getPublicCacheKey(`home:categories:${country ?? 'global'}:${Math.floor(Date.now() / 86400000)}:v2`);

export async function getHomeCategories(country: string | null) {
  const response = await apiGet<HomeCategoriesResponse>(`/catalog/home-categories${country ? `?country=${country}` : ''}`, { timeoutMs: 30_000 });
  for (const category of response.items) {
    setMemoryResource(homeCategoryResourceKey(category.id, country), category, new Date().toISOString());
  }
  return response;
}

export function getHomeCategory(id: string, country?: string | null, page = 1) {
  const query = new URLSearchParams({ page: String(page) });
  if (country) query.set('country', country);
  return apiGet<DiscoverCollectionResponse>(`/catalog/home-categories/${encodeURIComponent(id)}?${query}`, { timeoutMs: 30_000 });
}
