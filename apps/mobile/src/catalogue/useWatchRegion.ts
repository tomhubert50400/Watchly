import AsyncStorage from '@react-native-async-storage/async-storage';
import { requireOptionalNativeModule } from 'expo';
import { useEffect, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import { normalizeWatchRegion, resolveWatchRegion } from './watchRegionModel';

const storageKey = 'watchly.watch-region';
const nativeModule = requireOptionalNativeModule<{
  getCountryCode(): Promise<string | null>;
}>('WatchlyStorefront');
let state = { ready: false, override: null as string | null, storefront: null as string | null };
let initialization: Promise<void> | undefined;
let persistence = Promise.resolve();
const listeners = new Set<() => void>();

function publish(next: typeof state) {
  state = next;
  listeners.forEach((listener) => listener());
}

async function refreshStorefront() {
  const storefront = normalizeWatchRegion(await nativeModule?.getCountryCode().catch(() => null));
  if (storefront !== state.storefront) publish({ ...state, storefront });
}

function initialize() {
  initialization ??= Promise.all([
    AsyncStorage.getItem(storageKey).catch(() => null),
    nativeModule?.getCountryCode().catch(() => null),
  ]).then(([override, storefront]) => {
    publish({ ready: true, override: normalizeWatchRegion(override), storefront: normalizeWatchRegion(storefront) });
  });
  return initialization;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const subscription = AppState.addEventListener('change', (status) => {
    if (status === 'active') void initialize().then(refreshStorefront);
  });
  return () => {
    listeners.delete(listener);
    subscription.remove();
  };
}

export function useWatchRegion() {
  const snapshot = useSyncExternalStore(subscribe, () => state, () => state);
  useEffect(() => { void initialize(); }, []);
  return {
    ...snapshot,
    country: resolveWatchRegion(snapshot.override, snapshot.storefront),
    async setCountry(country: string | null) {
      await initialize();
      const override = normalizeWatchRegion(country);
      publish({ ...state, override });
      persistence = persistence.catch(() => undefined).then(() => override
        ? AsyncStorage.setItem(storageKey, override)
        : AsyncStorage.removeItem(storageKey));
      return persistence;
    },
  };
}
