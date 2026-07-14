import type { NotificationItem } from './notificationModel';

type NotificationResponse = {
  items: NotificationItem[];
};

type NotificationLoaderDependencies = {
  list: (token: string) => Promise<NotificationResponse>;
  sync: (token: string) => Promise<NotificationResponse>;
};

export async function loadNotificationItems(
  token: string,
  dependencies: NotificationLoaderDependencies,
): Promise<NotificationItem[]> {
  try {
    return (await dependencies.sync(token)).items;
  } catch (syncError) {
    try {
      return (await dependencies.list(token)).items;
    } catch {
      throw syncError;
    }
  }
}
