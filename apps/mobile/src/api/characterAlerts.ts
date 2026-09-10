import { apiDelete, apiGet, apiPut } from './client';

export type CharacterAlert = {
  key: string;
  name: string;
  continuity: string;
  enabled: boolean;
};

export function listCharacterAlerts(token: string, title?: { contentType: 'movie' | 'series'; tmdbId: number }) {
  const path = title ? `/${title.contentType}/${title.tmdbId}` : '';
  return apiGet<{ items: CharacterAlert[] }>(`/notifications/characters${path}`, { token });
}

export function setCharacterAlert(token: string, key: string, enabled: boolean) {
  const path = `/notifications/characters/${encodeURIComponent(key)}`;
  return enabled ? apiPut<{ enabled: boolean }>(path, {}, { token }) : apiDelete<{ enabled: boolean }>(path, { token });
}
