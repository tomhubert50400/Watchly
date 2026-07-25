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
  tmdbId: number;
};

export type PersonalWatchlist = {
  createdAt: string;
  id: string;
  items: PersonalWatchlistItem[];
  name: string;
  updatedAt: string;
  visibility: PersonalWatchlistVisibility;
};

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

export function getWatchlist(token: string, watchlistId: string) {
  return apiGet<PersonalWatchlist>(`/watchlists/${watchlistId}`, { token });
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
