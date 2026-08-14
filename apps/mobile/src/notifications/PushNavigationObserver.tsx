import { useEffect } from 'react';
import * as Notifications from 'expo-notifications';
import { Linking } from 'react-native';

export function PushNavigationObserver() {
  useEffect(() => {
    let active = true;

    const openResponse = async (response: Notifications.NotificationResponse | null) => {
      if (!active) return;
      const url = response?.notification.request.content.data.url;
      if (typeof url !== 'string' || !url.startsWith('tvapp://')) return;

      await Linking.openURL(url);
      await Notifications.clearLastNotificationResponseAsync();
    };

    void Notifications.getLastNotificationResponseAsync()
      .then(openResponse)
      .catch(() => undefined);
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      void openResponse(response).catch(() => undefined);
    });

    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  return null;
}
