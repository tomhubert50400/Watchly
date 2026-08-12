import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Sentry from '@sentry/react-native';
import type { ComponentType } from 'react';
import { appEnvironment, publicEnv } from '../config/publicEnv';
import { sanitizeMobileErrorEvent } from './errorTrackingEvent';
import {
  createMobileMonitoringProbeError,
  getMobileMonitoringProbeStorageKey,
  getNativeCrashProbeStorageKey,
  resolveMobileMonitoringProbeId,
} from './mobileMonitoringProbe';

let errorTrackingEnabled = false;

export function initializeErrorTracking() {
  const dsn = publicEnv.EXPO_PUBLIC_ERROR_TRACKING_DSN?.trim();
  if (!dsn) return false;

  Sentry.init({
    beforeSend: sanitizeMobileErrorEvent,
    dsn,
    environment: appEnvironment,
    onReady: () => {
      void runNativeCrashMonitoringProbe().catch(() => undefined);
    },
    sendDefaultPii: false,
    tracesSampleRate: 0,
  });
  errorTrackingEnabled = true;
  void runMobileMonitoringProbe().catch(() => undefined);
  return true;
}

async function runMobileMonitoringProbe() {
  const probeId = resolveMobileMonitoringProbeId(
    appEnvironment,
    publicEnv.EXPO_PUBLIC_MONITORING_PROBE_ID,
  );
  if (!probeId) return;

  const storageKey = getMobileMonitoringProbeStorageKey(probeId);
  if (await AsyncStorage.getItem(storageKey)) return;

  let eventId = '';
  Sentry.withScope((scope) => {
    scope.setTag('monitoring_probe_id', probeId);
    eventId = Sentry.captureException(createMobileMonitoringProbeError());
  });

  if (await Sentry.flush()) {
    await AsyncStorage.setItem(storageKey, eventId);
  }
}

async function runNativeCrashMonitoringProbe() {
  const probeId = resolveMobileMonitoringProbeId(
    appEnvironment,
    publicEnv.EXPO_PUBLIC_NATIVE_CRASH_PROBE_ID,
  );
  if (!probeId) return;

  const storageKey = getNativeCrashProbeStorageKey(probeId);
  if (await AsyncStorage.getItem(storageKey)) return;

  await AsyncStorage.setItem(storageKey, 'armed');
  Sentry.setTag('native_crash_probe_id', probeId);
  await new Promise((resolve) => setTimeout(resolve, 1500));
  Sentry.nativeCrash();
}

export function withErrorTracking<P extends Record<string, unknown>>(
  rootComponent: ComponentType<P>,
) {
  return errorTrackingEnabled ? Sentry.wrap(rootComponent) : rootComponent;
}
