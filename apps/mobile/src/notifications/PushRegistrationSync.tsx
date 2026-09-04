import { useEffect } from 'react';
import * as Notifications from 'expo-notifications';
import { AppState } from 'react-native';
import { useAuthSession } from '../auth/AuthSessionContext';
import { synchronizeExistingPushRegistration } from './nativePushNotifications';

export function PushRegistrationSync() {
  const { firebaseIdToken, getFirebaseIdToken } = useAuthSession();

  useEffect(() => {
    let active = true;
    let lastObservedToken: string | null = null;
    let synchronization: Promise<void> | null = null;

    const synchronize = () => {
      if (synchronization) return synchronization;

      synchronization = (async () => {
        const token = await getFirebaseIdToken();
        if (!active || !token) return;
        await synchronizeExistingPushRegistration(token).catch(() => undefined);
      })().finally(() => {
        synchronization = null;
      });

      return synchronization;
    };

    if (firebaseIdToken) void synchronize();
    const appStateSubscription = AppState.addEventListener('change', (state) => {
      if (state === 'active' && firebaseIdToken) void synchronize();
    });
    const tokenSubscription = Notifications.addPushTokenListener((token) => {
      const tokenKey = `${token.type}:${JSON.stringify(token.data)}`;
      if (!firebaseIdToken || tokenKey === lastObservedToken) return;
      lastObservedToken = tokenKey;
      void synchronize();
    });

    return () => {
      active = false;
      appStateSubscription.remove();
      tokenSubscription.remove();
    };
  }, [firebaseIdToken, getFirebaseIdToken]);

  return null;
}
