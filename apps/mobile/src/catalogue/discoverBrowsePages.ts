import type { DiscoverCollectionResponse, DiscoverItem } from '../api/discover';
import { getMemoryResource, setMemoryResource } from '../cache/memoryResourceCache';

export type DiscoverBrowsePages = {
  baseSavedAt: string | null;
  items: DiscoverItem[];
  page: number;
  hasMore: boolean;
};

export function restoreDiscoverBrowsePages(key: string, baseSavedAt: string | null, hasMore: boolean): DiscoverBrowsePages {
  const cached = getMemoryResource<DiscoverBrowsePages>(`${key}:pages`);
  return baseSavedAt && cached?.data.baseSavedAt === baseSavedAt
    ? cached.data
    : { baseSavedAt, items: [], page: 1, hasMore };
}

export function appendDiscoverBrowsePage(key: string, previous: DiscoverBrowsePages, response: DiscoverCollectionResponse): DiscoverBrowsePages {
  const next = {
    ...previous,
    items: [...new Map([...previous.items, ...response.items].map(item => [item.id, item])).values()],
    page: previous.page + 1,
    hasMore: response.hasMore,
  };
  setMemoryResource(`${key}:pages`, next, new Date().toISOString());
  return next;
}
