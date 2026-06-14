import { apiDelete, apiGet, apiPut } from './client';

export type BlockState = {
  blocked: boolean;
  blockedAt: string | null;
  userId: string;
};

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
