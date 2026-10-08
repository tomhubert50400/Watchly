import { useEffect, useRef, useState } from 'react';
import { getMemoryResource, setMemoryResource } from '../cache/memoryResourceCache';
import { getPrivateCacheKey, readPersistedCache, writePersistedCache } from '../cache/persistedCache';

export function useVoteExpansion(userId: string | null, watchlistId: string, target: string, defaultExpanded: boolean) {
  const key = getPrivateCacheKey(userId ?? 'visitor', `shared-watchlist:${watchlistId}:expansion:${target}:v1`);
  const scope = useRef({ key, changed: false });
  if (scope.current.key !== key) scope.current = { key, changed: false };
  const [state, setState] = useState(() => ({ key, value: getMemoryResource<boolean>(key)?.data }));
  const expanded = (state.key === key ? state.value : getMemoryResource<boolean>(key)?.data) ?? defaultExpanded;

  useEffect(() => {
    const expected = scope.current;
    let cancelled = false;
    const memory = getMemoryResource<boolean>(key);
    if (typeof memory?.data === 'boolean') {
      setState({ key, value: memory.data });
    } else {
      void readPersistedCache<boolean>(key).then(cached => {
        if (cancelled || scope.current !== expected || expected.changed || typeof cached?.data !== 'boolean') return;
        setMemoryResource(key, cached.data, cached.savedAt);
        setState({ key, value: cached.data });
      }).catch(() => undefined);
    }
    return () => { cancelled = true; };
  }, [key]);

  function toggle() {
    const value = !expanded;
    scope.current.changed = true;
    setState({ key, value });
    setMemoryResource(key, value, new Date().toISOString());
    void writePersistedCache(key, value).catch(() => undefined);
  }
  return [expanded, toggle] as const;
}
