import { apiDelete, apiGet, apiPut } from './client';

export type FollowState = {
  followedAt: string | null;
  following: boolean;
  status: 'none' | 'pending' | 'following';
  userId: string;
};

export type FollowRequest = {
  displayName: string | null;
  requestedAt: string;
  userId: string;
};

export function getFollowState(firebaseIdToken: string, userId: string): Promise<FollowState> {
  return apiGet<FollowState>(`/follows/${encodeURIComponent(userId)}`, {
    token: firebaseIdToken,
  });
}

export function followUser(firebaseIdToken: string, userId: string): Promise<FollowState> {
  return apiPut<FollowState>(`/follows/${encodeURIComponent(userId)}`, {}, {
    token: firebaseIdToken,
  });
}

export function unfollowUser(firebaseIdToken: string, userId: string): Promise<FollowState> {
  return apiDelete<FollowState>(`/follows/${encodeURIComponent(userId)}`, {
    token: firebaseIdToken,
  });
}

export function listFollowRequests(firebaseIdToken: string) {
  return apiGet<{ items: FollowRequest[] }>('/follows/requests', {
    token: firebaseIdToken,
  });
}

export function acceptFollowRequest(firebaseIdToken: string, userId: string) {
  return apiPut<{ accepted: true; userId: string }>(
    `/follows/requests/${encodeURIComponent(userId)}/accept`,
    {},
    { token: firebaseIdToken },
  );
}

export function rejectFollowRequest(firebaseIdToken: string, userId: string) {
  return apiDelete<{ rejected: true; userId: string }>(
    `/follows/requests/${encodeURIComponent(userId)}`,
    { token: firebaseIdToken },
  );
}
