import { apiDelete, apiGet, apiPut } from './client';

export type FollowState = {
  followedAt: string | null;
  following: boolean;
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
