import { useEffect } from 'react';
import * as Notifications from 'expo-notifications';
import { AppState } from 'react-native';
import { useAuthSession } from '../auth/AuthSessionContext';
import { synchronizeExistingPushRegistration } from './nativePushNotifications';

export function PushRegistrationSync() {
  const { firebaseIdToken, getFirebaseIdToken } = useAuthSession();

  useEffect(() => {
    let active = true;

    const synchronize = async () => {
      const token = await getFirebaseIdToken();
      if (!active || !token) return;
      await synchronizeExistingPushRegistration(token).catch(() => undefined);
    };

    if (firebaseIdToken) void synchronize();
    const appStateSubscription = AppState.addEventListener('change', (state) => {
      if (state === 'active' && firebaseIdToken) void synchronize();
    });
    const tokenSubscription = Notifications.addPushTokenListener(() => {
      if (firebaseIdToken) void synchronize();
    });

    return () => {
      active = false;
      appStateSubscription.remove();
      tokenSubscription.remove();
    };
  }, [firebaseIdToken, getFirebaseIdToken]);

  return null;
}
