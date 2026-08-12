import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';
import type { ComponentType } from 'react';
import { appEnvironment, publicEnv } from '../config/publicEnv';
import { sanitizeMobileErrorEvent } from './errorTrackingEvent';

let errorTrackingEnabled = false;

export function initializeErrorTracking() {
  const dsn = publicEnv.EXPO_PUBLIC_ERROR_TRACKING_DSN?.trim();
  if (!dsn) return false;

  Sentry.init({
    beforeSend: sanitizeMobileErrorEvent,
    dsn,
    environment: appEnvironment,
    release: Constants.expoConfig?.version,
    sendDefaultPii: false,
    tracesSampleRate: 0,
  });
  errorTrackingEnabled = true;
  return true;
}

export function withErrorTracking<P extends Record<string, unknown>>(
  rootComponent: ComponentType<P>,
) {
  return errorTrackingEnabled ? Sentry.wrap(rootComponent) : rootComponent;
}
