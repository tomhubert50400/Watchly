import { apiDelete, apiGet, apiPost, apiPut } from './client';
import { WatchlistContentType } from './watchlists';

export type SharedWatchlistSummary = {
  containsTitle?: boolean;
  createdAt: string;
  id: string;
  isOwner: boolean;
  itemCount: number;
  memberCount: number;
  name: string;
  updatedAt: string;
};

export type SharedWatchlistItem = {
  contentType: WatchlistContentType;
  createdAt: string;
  id: string;
  tmdbId: number;
};

export type SharedVotingCandidate = {
  contentType: WatchlistContentType;
  id: string;
  itemId: string;
  tmdbId: number;
  userHasVoted: boolean;
  voteCount: number;
};

export type SharedVotingSession = {
  candidates: SharedVotingCandidate[];
  closedAt: string | null;
  closesAt: string;
  createdAt: string;
  id: string;
  leaders: SharedVotingCandidate[];
  status: 'OPEN' | 'CLOSED';
  title: string;
  updatedAt: string;
  winningCandidateId: string | null;
};

export type SharedWatchlist = {
  createdAt: string;
  id: string;
  isOwner: boolean;
  items: SharedWatchlistItem[];
  memberCount: number;
  members: { displayName: string | null; id: string }[];
  name: string;
  updatedAt: string;
  votingSessions: SharedVotingSession[];
};

export function listSharedWatchlists(
  token: string,
  content?: { contentType: WatchlistContentType; tmdbId: number },
) {
  const params = new URLSearchParams();

  if (content) {
    params.set('contentType', content.contentType);
    params.set('tmdbId', String(content.tmdbId));
  }

  const query = params.toString();

  return apiGet<{ items: SharedWatchlistSummary[] }>(
    `/shared-watchlists${query ? `?${query}` : ''}`,
    { token },
  );
}

export function createSharedWatchlist(token: string, name: string) {
  return apiPost<SharedWatchlistSummary>('/shared-watchlists', { name }, { token });
}

export function getSharedWatchlist(token: string, watchlistId: string) {
  return apiGet<SharedWatchlist>(`/shared-watchlists/${watchlistId}`, { token });
}

export function deleteSharedWatchlist(token: string, watchlistId: string) {
  return apiDelete<{ deleted: true }>(`/shared-watchlists/${watchlistId}`, { token });
}

export function addSharedWatchlistItem(
  token: string,
  watchlistId: string,
  input: { contentType: WatchlistContentType; tmdbId: number },
) {
  return apiPut<SharedWatchlistItem>(`/shared-watchlists/${watchlistId}/items`, input, { token });
}

export function addSharedWatchlistMember(token: string, watchlistId: string, userId: string) {
  return apiPut<{ added: true }>(`/shared-watchlists/${watchlistId}/members`, { userId }, { token });
}

export function removeSharedWatchlistItem(
  token: string,
  watchlistId: string,
  contentType: WatchlistContentType,
  tmdbId: number,
) {
  const params = new URLSearchParams({ contentType, tmdbId: String(tmdbId) });

  return apiDelete<{ deleted: true }>(`/shared-watchlists/${watchlistId}/items?${params.toString()}`, {
    token,
  });
}

export function createSharedVotingSession(
  token: string,
  watchlistId: string,
  input: { itemIds: string[]; title: string },
) {
  return apiPost<SharedVotingSession>(`/shared-watchlists/${watchlistId}/voting-sessions`, input, {
    token,
  });
}

export function voteForSharedCandidate(
  token: string,
  watchlistId: string,
  sessionId: string,
  candidateId: string,
) {
  return apiPut<SharedVotingSession>(
    `/shared-watchlists/${watchlistId}/voting-sessions/${sessionId}/candidates/${candidateId}/vote`,
    {},
    { token },
  );
}

export function removeSharedCandidateVote(
  token: string,
  watchlistId: string,
  sessionId: string,
  candidateId: string,
) {
  return apiDelete<SharedVotingSession>(
    `/shared-watchlists/${watchlistId}/voting-sessions/${sessionId}/candidates/${candidateId}/vote`,
    { token },
  );
}

export function closeSharedVotingSession(
  token: string,
  watchlistId: string,
  sessionId: string,
) {
  return apiPut<SharedVotingSession>(
    `/shared-watchlists/${watchlistId}/voting-sessions/${sessionId}/close`,
    {},
    { token },
  );
}
