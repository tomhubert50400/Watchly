import { useEffect } from 'react';
import * as Notifications from 'expo-notifications';
import { Linking } from 'react-native';
import { notifyUserDataChanged } from '../sync/userDataEvents';

export function PushNavigationObserver() {
  useEffect(() => {
    let active = true;

    const openResponse = async (response: Notifications.NotificationResponse | null) => {
      if (!active) return;
      const url = response?.notification.request.content.data.url;
      if (typeof url !== 'string' || !url.startsWith('tvapp://')) return;

      const destination = new URL(url);
      if (response?.notification.request.content.data.kind === 'shared_vote_update'
        && destination.host === 'watchlists' && destination.pathname.startsWith('/shared/')) {
        destination.searchParams.set('view', 'votes');
      }
      await Linking.openURL(destination.toString());
      await Notifications.clearLastNotificationResponseAsync();
    };

    void Notifications.getLastNotificationResponseAsync()
      .then(openResponse)
      .catch(() => undefined);
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      void openResponse(response).catch(() => undefined);
    });
    const received = Notifications.addNotificationReceivedListener((notification) => {
      if (notification.request.content.data.kind === 'shared_list_invite') notifyUserDataChanged('notifications');
      if (notification.request.content.data.kind === 'shared_vote_update') notifyUserDataChanged('notifications', 'watchlists');
    });

    return () => {
      active = false;
      subscription.remove();
      received.remove();
    };
  }, []);

  return null;
}
