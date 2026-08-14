import { apiDelete, apiGet, apiPut } from './client';

export type PushPreferences = {
  pushEnabled: boolean;
  releasePushEnabled: boolean;
};

export function getPushPreferences(token: string) {
  return apiGet<PushPreferences>('/push/preferences', { token });
}

export function updatePushPreferences(token: string, preferences: Partial<PushPreferences>) {
  return apiPut<PushPreferences>('/push/preferences', preferences, { token });
}

export function registerPushDevice(
  token: string,
  expoPushToken: string,
  platform: 'android' | 'ios',
) {
  return apiPut<{ active: boolean; environment: string; platform: 'android' | 'ios' }>(
    '/push/device',
    { expoPushToken, platform },
    { token },
  );
}

export function revokePushDevice(token: string, expoPushToken: string) {
  return apiDelete<{ revoked: boolean }>('/push/device', {
    body: { expoPushToken },
    timeoutMs: 3_000,
    token,
  });
}
