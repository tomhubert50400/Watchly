type ToastAnnouncementInput = {
  id: number;
  message: string;
};

export function getToastAccessibility({ id, message }: ToastAnnouncementInput) {
  return {
    accessibilityLiveRegion: 'assertive' as const,
    accessibilityRole: 'alert' as const,
    announcement: message,
    announcementKey: `toast-announcement-${id}`,
  };
}
