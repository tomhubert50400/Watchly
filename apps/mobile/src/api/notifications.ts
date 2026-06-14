import { apiGet, apiPost, apiPut } from './client';

export type ReleaseNotification = {
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

export type NotificationsResponse = {
  items: ReleaseNotification[];
};

export type NotificationsSyncResponse = NotificationsResponse & {
  createdCount: number;
  syncedContentCount: number;
};

export function listNotifications(token: string) {
  return apiGet<NotificationsResponse>('/notifications', { token });
}

export function syncNotifications(token: string) {
  return apiPost<NotificationsSyncResponse>('/notifications/sync', {}, { token });
}

export function markNotificationRead(token: string, notificationId: string) {
  return apiPut<{ updated: boolean }>(`/notifications/${notificationId}/read`, {}, { token });
}
