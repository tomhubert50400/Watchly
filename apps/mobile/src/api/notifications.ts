import { apiDelete, apiGet, apiPut } from './client';

type ReleaseNotification = {
  body: string;
  contentType: 'movie' | 'series';
  createdAt: string;
  episodeNumber: number | null;
  id: string;
  readAt: string | null;
  releasedAt: string | null;
  seasonNumber: number | null;
  title: string;
  tmdbId: number;
  type: 'movie_release' | 'season_release' | 'episode_release';
};

export type ReleaseAlertContentType = 'movie' | 'series';

export type ReleaseAlertState = {
  enabled: boolean;
  items: ReleaseNotification[];
};

export type ReleaseAlertSummary = {
  contentType: ReleaseAlertContentType;
  tmdbId: number;
  updatedAt: string;
};

export type ReleaseAlertsResponse = {
  items: ReleaseAlertSummary[];
};

export function listReleaseAlerts(token: string) {
  return apiGet<ReleaseAlertsResponse>('/notifications/release-alerts', { token });
}

export function getReleaseAlert(
  token: string,
  contentType: ReleaseAlertContentType,
  tmdbId: number,
) {
  return apiGet<ReleaseAlertState>(`/notifications/release-alerts/${contentType}/${tmdbId}`, {
    token,
  });
}

export function enableReleaseAlert(
  token: string,
  contentType: ReleaseAlertContentType,
  tmdbId: number,
) {
  return apiPut<ReleaseAlertState>(
    `/notifications/release-alerts/${contentType}/${tmdbId}`,
    {},
    { token },
  );
}

export function disableReleaseAlert(
  token: string,
  contentType: ReleaseAlertContentType,
  tmdbId: number,
) {
  return apiDelete<ReleaseAlertState>(`/notifications/release-alerts/${contentType}/${tmdbId}`, {
    token,
  });
}
