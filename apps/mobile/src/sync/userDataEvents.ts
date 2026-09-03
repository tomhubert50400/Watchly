import { useCallback, useMemo, useSyncExternalStore } from 'react';

export type UserDataDomain =
  | 'episodeProgress'
  | 'feed'
  | 'notifications'
  | 'opinions'
  | 'profile'
  | 'releaseAlerts'
  | 'socialGraph'
  | 'tracking'
  | 'viewings'
  | 'watchlists';

const revisions: Record<UserDataDomain, number> = {
  episodeProgress: 0,
  feed: 0,
  notifications: 0,
  opinions: 0,
  profile: 0,
  releaseAlerts: 0,
  socialGraph: 0,
  tracking: 0,
  viewings: 0,
  watchlists: 0,
};
const listeners = new Map<UserDataDomain, Set<() => void>>();

export function notifyUserDataChanged(...domains: UserDataDomain[]) {
  const changedDomains = new Set(domains);
  const listenersToNotify = new Set<() => void>();

  changedDomains.forEach((domain) => {
    revisions[domain] += 1;
    listeners.get(domain)?.forEach((listener) => listenersToNotify.add(listener));
  });
  listenersToNotify.forEach((listener) => listener());
}

export function getUserDataRevision(domains: readonly UserDataDomain[]) {
  return domains.map((domain) => revisions[domain]).join(':');
}

export function subscribeToUserData(
  domains: readonly UserDataDomain[],
  listener: () => void,
) {
  domains.forEach((domain) => {
    const domainListeners = listeners.get(domain) ?? new Set<() => void>();
    domainListeners.add(listener);
    listeners.set(domain, domainListeners);
  });

  return () => {
    domains.forEach((domain) => {
      const domainListeners = listeners.get(domain);
      domainListeners?.delete(listener);
      if (domainListeners?.size === 0) listeners.delete(domain);
    });
  };
}

export function useUserDataRevision(...domains: UserDataDomain[]) {
  const domainKey = [...new Set(domains)].sort().join(':');
  const stableDomains = useMemo(
    () => domainKey.split(':').filter(Boolean) as UserDataDomain[],
    [domainKey],
  );
  const subscribe = useCallback(
    (listener: () => void) => subscribeToUserData(stableDomains, listener),
    [stableDomains],
  );
  const getSnapshot = useCallback(
    () => getUserDataRevision(stableDomains),
    [stableDomains],
  );

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
