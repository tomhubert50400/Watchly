type ToastAnnouncementInput = {
  id: number;
  message: string;
  tone?: 'error' | 'info' | 'success';
};

export function getToastAccessibility({ id, message, tone }: ToastAnnouncementInput) {
  const informational = tone === 'info';

  return {
    accessibilityLiveRegion: informational ? 'polite' as const : 'assertive' as const,
    accessibilityRole: informational ? 'text' as const : 'alert' as const,
    announcement: message,
    announcementKey: `toast-announcement-${id}`,
  };
}
