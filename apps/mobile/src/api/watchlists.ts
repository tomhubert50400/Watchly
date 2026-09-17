import { apiDelete, apiGet, apiPost, apiPut } from './client';

export type WatchlistContentType = 'movie' | 'series';
export type PersonalWatchlistVisibility = 'public' | 'private';

export type PersonalWatchlistSummary = {
  containsTitle?: boolean;
  createdAt: string;
  id: string;
  itemCount: number;
  name: string;
  updatedAt: string;
  visibility: PersonalWatchlistVisibility;
};

export type PersonalWatchlistItem = {
  contentType: WatchlistContentType;
  createdAt: string;
  id: string;
  sectionId: string | null;
  tmdbId: number;
};

export type PersonalWatchlistSection = {
  createdAt: string;
  id: string;
  name: string;
  position: number;
  updatedAt: string;
};

export type PersonalWatchlist = {
  coverItemIds?: string[];
  createdAt: string;
  id: string;
  items: PersonalWatchlistItem[];
  name: string;
  sections: PersonalWatchlistSection[];
  updatedAt: string;
  visibility: PersonalWatchlistVisibility;
};

type PersonalWatchlistPayload = Omit<PersonalWatchlist, 'items' | 'sections'> & {
  items: Array<Omit<PersonalWatchlistItem, 'sectionId'> & { sectionId?: string | null }>;
  sections?: PersonalWatchlistSection[];
};

export function normalizePersonalWatchlist(watchlist: PersonalWatchlistPayload): PersonalWatchlist {
  return {
    ...watchlist,
    items: watchlist.items.map((item) => ({ ...item, sectionId: item.sectionId ?? null })),
    sections: watchlist.sections ?? [],
  };
}

export function listWatchlists(
  token: string,
  content?: { contentType: WatchlistContentType; tmdbId: number },
) {
  const params = new URLSearchParams();

  if (content) {
    params.set('contentType', content.contentType);
    params.set('tmdbId', String(content.tmdbId));
  }

  const query = params.toString();

  return apiGet<{ items: PersonalWatchlistSummary[] }>(`/watchlists${query ? `?${query}` : ''}`, {
    token,
  });
}

export function createWatchlist(token: string, name: string) {
  return apiPost<PersonalWatchlistSummary>('/watchlists', { name }, { token });
}

export async function getWatchlist(token: string, watchlistId: string) {
  const watchlist = await apiGet<PersonalWatchlistPayload>(`/watchlists/${watchlistId}`, { token });

  return normalizePersonalWatchlist(watchlist);
}

export function deleteWatchlist(token: string, watchlistId: string) {
  return apiDelete<{ deleted: true }>(`/watchlists/${watchlistId}`, { token });
}

export function updateWatchlistVisibility(
  token: string,
  watchlistId: string,
  visibility: PersonalWatchlistVisibility,
) {
  return apiPut<PersonalWatchlistSummary>(
    `/watchlists/${watchlistId}`,
    { visibility },
    { token },
  );
}

export function addWatchlistItem(
  token: string,
  watchlistId: string,
  input: { contentType: WatchlistContentType; tmdbId: number },
) {
  return apiPut<PersonalWatchlistItem>(`/watchlists/${watchlistId}/items`, input, { token });
}

export function removeWatchlistItem(
  token: string,
  watchlistId: string,
  contentType: WatchlistContentType,
  tmdbId: number,
) {
  const params = new URLSearchParams({ contentType, tmdbId: String(tmdbId) });

  return apiDelete<{ deleted: true }>(`/watchlists/${watchlistId}/items?${params.toString()}`, {
    token,
  });
}

export function createWatchlistSection(token: string, watchlistId: string, name: string) {
  return apiPost<PersonalWatchlistSection>(`/watchlists/${watchlistId}/sections`, { name }, { token });
}

export function updateWatchlistSection(
  token: string,
  watchlistId: string,
  sectionId: string,
  name: string,
) {
  return apiPut<PersonalWatchlistSection>(
    `/watchlists/${watchlistId}/sections/${sectionId}`,
    { name },
    { token },
  );
}

export function deleteWatchlistSection(token: string, watchlistId: string, sectionId: string) {
  return apiDelete<{ deleted: true }>(`/watchlists/${watchlistId}/sections/${sectionId}`, { token });
}

export function moveWatchlistItemToSection(
  token: string,
  watchlistId: string,
  itemId: string,
  sectionId: string | null,
) {
  return apiPut<PersonalWatchlistItem>(
    `/watchlists/${watchlistId}/items/${itemId}/section`,
    { sectionId },
    { token },
  );
}
