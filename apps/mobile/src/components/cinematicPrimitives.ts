export type BannerTone = 'error' | 'offline' | 'success' | 'updating';

export type BannerPresentation = {
  accessibilityRole: 'alert' | 'summary';
  defaultTitle: string;
  icon: 'error' | 'offline' | 'refresh' | 'success';
  showsActivity: boolean;
};

const bannerPresentations: Record<BannerTone, BannerPresentation> = {
  error: {
    accessibilityRole: 'alert',
    defaultTitle: 'Unable to update',
    icon: 'error',
    showsActivity: false,
  },
  offline: {
    accessibilityRole: 'alert',
    defaultTitle: 'You are offline',
    icon: 'offline',
    showsActivity: false,
  },
  success: {
    accessibilityRole: 'summary',
    defaultTitle: 'Up to date',
    icon: 'success',
    showsActivity: false,
  },
  updating: {
    accessibilityRole: 'summary',
    defaultTitle: 'Updating',
    icon: 'refresh',
    showsActivity: true,
  },
};

export function normalizeRating(value: number, maximum = 5): number {
  if (!Number.isFinite(value) || maximum <= 0) {
    return 0;
  }

  return Math.min(maximum, Math.max(0, Math.round(value * 2) / 2));
}

export function getStarFillRatios(value: number, maximum = 5): number[] {
  const normalized = normalizeRating(value, maximum);
  return Array.from({ length: maximum }, (_, index) =>
    Math.min(1, Math.max(0, normalized - index)),
  );
}

export function getBannerPresentation(tone: BannerTone): BannerPresentation {
  return bannerPresentations[tone];
}
