import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Sentry from '@sentry/react-native';
import type { ComponentType } from 'react';
import { appEnvironment, publicEnv } from '../config/publicEnv';
import { sanitizeMobileErrorEvent } from './errorTrackingEvent';
import {
  createMobileMonitoringProbeError,
  getMobileMonitoringProbeStorageKey,
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

export function withErrorTracking<P extends Record<string, unknown>>(
  rootComponent: ComponentType<P>,
) {
  return errorTrackingEnabled ? Sentry.wrap(rootComponent) : rootComponent;
}
