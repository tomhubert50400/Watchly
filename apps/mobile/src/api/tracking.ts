import { apiDelete, apiGet, apiPut } from './client';

export type TrackedContentType = 'movie' | 'series';
export type TrackingStatus = 'watchlisted' | 'watching' | 'watched' | 'dropped';

export type TrackingState = {
  contentType: TrackedContentType;
  favorite: boolean;
  id: string;
  status: TrackingStatus | null;
  tmdbId: number;
  updatedAt: string;
};

type UpsertTrackingStateInput = {
  contentType: TrackedContentType;
  favorite?: boolean;
  status?: TrackingStatus | null;
  tmdbId: number;
};

export function getTrackingState(token: string, contentType: TrackedContentType, tmdbId: number) {
  const params = new URLSearchParams({ contentType, tmdbId: String(tmdbId) });

  return apiGet<TrackingState | null>(`/tracking/states?${params.toString()}`, { token });
}

export function listTrackingStates(token: string, contentType?: TrackedContentType) {
  const params = new URLSearchParams();

  if (contentType) {
    params.set('contentType', contentType);
  }

  const query = params.toString();

  return apiGet<TrackingState[]>(`/tracking/states${query ? `?${query}` : ''}`, { token });
}

export function upsertTrackingState(token: string, input: UpsertTrackingStateInput) {
  return apiPut<TrackingState | null>('/tracking/states', input, { token });
}

export function deleteTrackingState(token: string, contentType: TrackedContentType, tmdbId: number) {
  const params = new URLSearchParams({ contentType, tmdbId: String(tmdbId) });

  return apiDelete<{ deleted: true }>(`/tracking/states?${params.toString()}`, { token });
}
