import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import {
  activeWatchRegionOverride, normalizeWatchRegion, readWatchRegionOverride,
  resolveWatchRegion, watchRegionOverrideDuration, type WatchRegionOverride,
} from './watchRegionModel';
import { fetchWatchRegionCountry } from './watchRegionIp';

const storageKey = 'watchly.watch-region';
let state = { ready: false, override: null as WatchRegionOverride | null, ipCountry: null as string | null };
let initialization: Promise<void> | undefined;
let ipRequest: Promise<void> | undefined;
let persistence = Promise.resolve();
let expiryTimer: ReturnType<typeof setTimeout> | undefined;
let appSubscription: ReturnType<typeof AppState.addEventListener> | undefined;
const listeners = new Set<() => void>();

function scheduleExpiry() {
  clearTimeout(expiryTimer);
  if (listeners.size && state.override) {
    expiryTimer = setTimeout(expireOverride, Math.max(0, state.override.expiresAt - Date.now()));
  }
}

function publish(next: typeof state) {
  state = next;
  scheduleExpiry();
  listeners.forEach((listener) => listener());
}

function persistOverride() {
  const override = state.override;
  persistence = persistence.catch(() => undefined).then(() => override
    ? AsyncStorage.setItem(storageKey, JSON.stringify(override))
    : AsyncStorage.removeItem(storageKey));
  return persistence;
}

function refreshIpCountry() {
  ipRequest ??= fetchWatchRegionCountry().then((ipCountry) => {
    publish({ ...state, ipCountry });
  }).finally(() => { ipRequest = undefined; });
  return ipRequest;
}

function expireOverride() {
  if (state.override && !activeWatchRegionOverride(state.override)) {
    publish({ ...state, override: null, ipCountry: null });
    void persistOverride().catch(() => undefined);
    void refreshIpCountry();
  }
}

function initialize() {
  initialization ??= AsyncStorage.getItem(storageKey).catch(() => null).then((stored) => {
    const override = readWatchRegionOverride(stored);
    publish({ ...state, ready: true, override: activeWatchRegionOverride(override) ? override : null });
    if (stored && !state.override) void persistOverride().catch(() => undefined);
    void refreshIpCountry();
  });
  return initialization;
}

function subscribe(listener: () => void) {
  const refreshOnMount = state.ready && !listeners.size;
  listeners.add(listener);
  if (!appSubscription) {
    appSubscription = AppState.addEventListener('change', (status) => {
      if (status === 'active') void initialize().then(() => {
        expireOverride();
        void refreshIpCountry();
      });
    });
  }
  void initialize().then(() => {
    expireOverride();
    scheduleExpiry();
    if (refreshOnMount) void refreshIpCountry();
  });
  return () => {
    listeners.delete(listener);
    if (!listeners.size) {
      appSubscription?.remove();
      appSubscription = undefined;
      clearTimeout(expiryTimer);
    }
  };
}

export function useWatchRegion() {
  const snapshot = useSyncExternalStore(subscribe, () => state, () => state);
  return {
    ...snapshot,
    country: resolveWatchRegion(snapshot.override, snapshot.ipCountry),
    async setCountry(country: string | null) {
      await initialize();
      const normalized = normalizeWatchRegion(country);
      const override = normalized ? { country: normalized, expiresAt: Date.now() + watchRegionOverrideDuration } : null;
      publish({ ...state, override });
      if (!override) void refreshIpCountry();
      return persistOverride();
    },
  };
}
