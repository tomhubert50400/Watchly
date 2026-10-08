import { apiDelete, apiGet, apiPost, apiPut } from './client';
import { WatchlistContentType } from './watchlists';

export type SharedWatchlistSummary = {
  members?: { id: string; displayName: string | null; avatarUrl: string | null }[];
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
  voters?: { id: string; displayName: string; avatarUrl?: string | null }[];
  contentType: WatchlistContentType;
  id: string;
  itemId: string;
  tmdbId: number;
  userHasVoted: boolean;
  voteCount: number;
};

export type SharedVotingSession = {
  isCreator?: boolean;
  allowMultipleVotes?: boolean;
  isAnonymous?: boolean;
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
  backgroundItemId?: string | null;
  coverItemIds?: string[];
  createdAt: string;
  id: string;
  isOwner: boolean;
  items: SharedWatchlistItem[];
  memberCount: number;
  members: { avatarUrl?: string | null; displayName: string | null; id: string }[];
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

export function leaveSharedWatchlist(token: string, watchlistId: string) {
  return apiDelete<{ left: true }>(`/shared-watchlists/${watchlistId}/members/me`, { token });
}

export function addSharedWatchlistItem(
  token: string,
  watchlistId: string,
  input: { contentType: WatchlistContentType; tmdbId: number },
) {
  return apiPut<SharedWatchlistItem>(`/shared-watchlists/${watchlistId}/items`, input, { token });
}

export type WatchlistInvitee = {
  id: string;
  avatarUrl: string | null;
  displayName: string;
  handle: string | null;
  isFollowing: boolean;
  followsYou: boolean;
  state: 'available' | 'member' | 'pending' | 'restricted' | 'recently_invited';
};

export function searchWatchlistInvitees(token: string, watchlistId: string, query: string) {
  return apiGet<{ items: WatchlistInvitee[] }>(`/shared-watchlists/${watchlistId}/invitees?q=${encodeURIComponent(query)}`, { token });
}

export function inviteSharedWatchlistMember(token: string, watchlistId: string, userId: string) {
  return apiPut<{ invited: true }>(`/shared-watchlists/${watchlistId}/members`, { userId }, { token });
}

export function respondToWatchlistInvitation(token: string, invitationId: string, accept: boolean) {
  return apiPut<{ status: 'accepted' | 'declined'; watchlistId: string; title: string }>(
    `/shared-watchlists/invitations/${invitationId}/${accept ? 'accept' : 'decline'}`, {}, { token },
  );
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
  input: { itemIds?: string[]; titles?: { contentType: 'movie' | 'series'; tmdbId: number }[]; title: string; durationMinutes?: number; isAnonymous?: boolean; allowMultipleVotes?: boolean },
) {
  return apiPost<SharedVotingSession>(`/shared-watchlists/${watchlistId}/voting-sessions`, input, {
    token,
  });
}

export function addSharedVotingCandidates(token: string, watchlistId: string, sessionId: string, titles: { contentType: 'movie' | 'series'; tmdbId: number }[]) {
  return apiPost<SharedVotingSession>(`/shared-watchlists/${watchlistId}/voting-sessions/${sessionId}/candidates`, { titles }, { token });
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

export function dismissSharedVotingSession(token: string, watchlistId: string, sessionId: string) {
  return apiDelete<{ hidden: true }>(`/shared-watchlists/${watchlistId}/voting-sessions/${sessionId}/view`, { token });
}

export function deleteSharedVotingSession(token: string, watchlistId: string, sessionId: string) {
  return apiDelete<{ deleted: true }>(`/shared-watchlists/${watchlistId}/voting-sessions/${sessionId}`, { token });
}
