export const rootStackScreenOptions = {
  headerBackButtonDisplayMode: 'minimal',
} as const;

// Screens 4.16 can leave the native back button disabled after a pop on iOS 26.
export function needsCustomStackBackButton(platform: string, version: string | number) {
  return platform === 'ios' && Number.parseInt(String(version), 10) >= 26;
}

type BackRoute = {
  name: string;
  params?: unknown;
  state?: {
    index?: number;
    routes: ReadonlyArray<{ name: string }>;
  };
};

const routeLabels: Record<string, string> = {
  MainTabs: 'Home',
  Notifications: 'Alerts',
  ReleaseCalendar: 'Calendar',
  Onboarding: 'Tastes',
  PublicProfile: 'Profile',
  SharedVotingSession: 'Vote',
};

export function resolvePreviousPageLabel(routes: readonly BackRoute[]) {
  const previous = routes.at(-2);
  if (!previous) return undefined;

  if (previous.name === 'MainTabs' && previous.state?.routes.length) {
    const activeIndex = previous.state.index ?? 0;
    return previous.state.routes[activeIndex]?.name ?? 'Home';
  }

  const params = previous.params;
  if (params && typeof params === 'object' && 'title' in params) {
    const title = params.title;
    if (typeof title === 'string' && title.trim()) return title;
  }

  return routeLabels[previous.name] ?? previous.name.replace(/([a-z])([A-Z])/g, '$1 $2');
}

export function detailBackOptions(backLabel?: string) {
  return {
    headerBackButtonDisplayMode: 'default',
    headerBackTitle: backLabel ?? 'Back',
  } as const;
}
