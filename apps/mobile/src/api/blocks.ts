import { apiDelete, apiGet, apiPut } from './client';

export type BlockState = {
  blocked: boolean;
  blockedAt: string | null;
  userId: string;
};

export type BlockedUser = {
  avatarUrl: string | null;
  blockedAt: string;
  displayName: string;
  handle: string | null;
  userId: string;
};

export type BlockedUsersPage = {
  items: BlockedUser[];
  nextCursor: string | null;
};

export function listBlockedUsers(
  firebaseIdToken: string,
  cursor?: string,
): Promise<BlockedUsersPage> {
  return apiGet<BlockedUsersPage>(
    `/blocks${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`,
    { token: firebaseIdToken },
  );
}

export function getBlockState(firebaseIdToken: string, userId: string): Promise<BlockState> {
  return apiGet<BlockState>(`/blocks/${encodeURIComponent(userId)}`, {
    token: firebaseIdToken,
  });
}

export function blockUser(firebaseIdToken: string, userId: string): Promise<BlockState> {
  return apiPut<BlockState>(`/blocks/${encodeURIComponent(userId)}`, {}, {
    token: firebaseIdToken,
  });
}

export function unblockUser(firebaseIdToken: string, userId: string): Promise<BlockState> {
  return apiDelete<BlockState>(`/blocks/${encodeURIComponent(userId)}`, {
    token: firebaseIdToken,
  });
}
